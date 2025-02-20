import type * as fsType from "fs";
import type { Stats } from "fs";
import type * as pathType from "path";
import Concurrency from "util/Concurrency";

let nodefs: typeof fsType;
let path: typeof pathType;

const fileWriteLocks = new Map<string, Promise<void>>();

class FileSystemMethods {

	private readonly concurrent: Concurrency;

	public constructor (concurrentMax = 5) {
		this.concurrent = new Concurrency(concurrentMax);
	}

	public async readdir (dir: string) {
		return this.concurrent.promise<string[]>((resolve, reject) => {
			nodefs.readdir(dir, (err, files) => {
				if (err) {
					if (err.code === "ENOENT") resolve([]);
					else reject(err);
				} else resolve(files);
			});
		});
	}

	public async readFile (filepath: string, encoding: string): Promise<string>;
	public async readFile (filepath: string): Promise<Buffer>;
	public async readFile (filepath: string, encoding?: string): Promise<string | Buffer>;
	public async readFile (filepath: string, encoding?: string) {
		return this.concurrent.promise<string | Buffer>((resolve, reject) => {
			nodefs.readFile(filepath, encoding, (err, file) => {
				if (err) reject(err);
				else resolve(file);
			});
		});
	}

	public async exists (filepath: string) {
		return new Promise<boolean>((resolve, reject) => {
			nodefs.stat(filepath, (err, stats) => {
				resolve(!err);
			});
		});
	}

	public async stat (filepath: string) {
		return new Promise<Stats | undefined>((resolve, reject) => {
			nodefs.stat(filepath, (err, stats) => {
				resolve(err ? undefined : stats);
			});
		});
	}

	public async writeFile (filepath: string, data: string | Buffer) {
		const absolutePath = path.resolve(filepath);

		await fileWriteLocks.get(absolutePath);

		const promise = this.concurrent.promise<void>((resolve, reject) => {
			nodefs.writeFile(filepath, data, err => {
				fileWriteLocks.delete(absolutePath);

				if (err) reject(err);
				else resolve();
			});
		});

		fileWriteLocks.set(absolutePath, promise);

		return promise;
	}

	public async mkdir (filepath: string) {
		return this.concurrent.promise<void>((resolve, reject) => {
			return this.mkdirp(filepath).then(resolve).catch(reject);
		});
	}

	public async unlink (filepath: string, errorIfNotExist?: true): Promise<void>;
	public async unlink (filepath: string, errorIfNotExist = false) {
		return this.concurrent.promise<void>((resolve, reject) => {
			nodefs.unlink(filepath, err => {
				if (err && errorIfNotExist) reject(err);
				else resolve();
			});
		});
	}

	public async rename (filepath: string, newFilepath: string) {
		return this.concurrent.promise<void>((resolve, reject) => {
			nodefs.rename(filepath, newFilepath, err => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	public async writeToUserChoice (data: string, defaultPath?: string) {
		const dialog = await window.send<Electron.SaveDialogReturnValue>("dialog-show-save", { defaultPath } as Electron.SaveDialogOptions);
		if (!dialog.filePath) return;
		void this.writeFile(dialog.filePath, data);
	}

	private async mkdirp (filepath: string) {
		filepath = path.resolve(filepath);

		return new Promise<void>((resolve, reject) => nodefs.mkdir(filepath, err => {
			if (!err || err.code === "EEXIST") return resolve();

			if (err.code === "ENOENT") {
				this.mkdirp(path.dirname(filepath))
					.then(() => this.mkdirp(filepath).then(resolve))
					.catch(reject);
				return;
			}

			nodefs.stat(filepath, (err2, stat) => {
				if (err2 || !stat.isDirectory()) reject(err);
				else resolve();
			});
		}));
	}

}

class FileSystem extends FileSystemMethods {

	public priority = new FileSystemMethods(Infinity);

	public initialize (
		nodefs_: typeof fsType,
		path_: typeof pathType,
	) {
		nodefs = nodefs_;
		path = path_;
	}
}

export default new FileSystem;

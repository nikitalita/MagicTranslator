import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Explorer from "component/content/Explorer";
import Extractor from "component/content/Extractor";
import Interrupt from "component/shared/Interrupt";
import Projects from "data/Projects";
import Options from "Options";
import { tuple } from "util/Arrays";
import { ComponentEvent } from "util/Manipulator";
import Language from "util/string/Language";

export default class Content extends Component {

	public constructor () {
		super();
		this.setId("content");

		// window.send("window-toggle-devtools");

		this.initialize();
	}

	public async initialize () {
		await Language.waitForLanguage();

		new Interrupt().hide().appendTo(this);

		await Promise.all([
			Options.waitForOptions(),
			new CharacterEditor().hide().appendTo(this),
			Projects.load(),
		]);

		Projects.current = Projects.valueStream().first()!;
		CharacterEditor.chooseCharacter();

		Component.window.listeners.until(this.listeners.waitFor("remove"))
			.add("keyup", this.keyup, true);

		this.showExplorer();
	}

	public showExplorer (startLocation?: [number, number]) {
		this.children().drop(2).collectStream().forEach(child => child.remove());

		new Explorer(startLocation)
			.listeners.add("extract", this.onExtractPage)
			.appendTo(this);
	}

	public async extractPage (volume: number, chapter: number, page: number) {
		const pages = Projects.current!.volumes.getByIndex(volume)!.getByIndex(chapter)!;
		return this.onExtractPage({ data: [volume, chapter, page, page > 0, page < pages.length - 1] } as any);
	}

	@Bound private async onExtractPage ({ data }: ComponentEvent<[number, number, number, boolean, boolean]>): Promise<Extractor> {
		this.children().drop(2).collectStream().forEach(child => child.remove());

		const [volume, chapter, page] = data;
		const pages = Projects.current!.volumes.getByIndex(volume)!.getByIndex(chapter)!;

		return new Extractor(...data)
			.listeners.add("quit", () => this.showExplorer(tuple(volume, chapter)))
			.listeners.add("previous", () => this.onExtractPage({ data: [volume, chapter, page - 1, page > 1, true] } as any))
			.listeners.add("next", () => this.onExtractPage({ data: [volume, chapter, page + 1, true, page < pages.length - 2] } as any))
			.appendTo(this)
			.initialize();
	}

	@Bound private keyup (event: KeyboardEvent) {
		if (event.code === "F12") window.send("window-toggle-devtools");
		if (event.code === "F11") window.send("window-toggle-fullscreen");
	}

}

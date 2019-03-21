import Component from "component/Component";
import Character from "component/content/character/Character";
import CharacterEditor from "component/content/character/CharacterEditor";
import Note from "component/content/extractor/Note";
import SortableList, { SortableListEvent, SortableListItem } from "component/shared/SortableList";
import Textarea from "component/shared/Textarea";
import { CaptureData } from "data/Captures";
import Bound from "util/Bound";
import Collectors from "util/Collectors";
import { tuple } from "util/IterableIterator";
import { pad } from "util/string/String";

export default class Capture extends SortableListItem {

	private readonly img: Component;
	private readonly notes: SortableList;

	public constructor (root: string, private readonly capture: CaptureData) {
		super();
		this.classes.add("capture");

		new Component()
			.append(this.img = new Component("img")
				.attributes.set("src", `${root}/cap${pad(capture.id!, 3)}.png`))
			.appendTo(this);

		new Component()
			.append(new Textarea()
				.classes.add("japanese")
				.listeners.add(["change", "blur"], this.changeTextarea)
				.setText(() => capture.text)
				.setPlaceholder("source-placeholder"))
			.append(new Textarea()
				.classes.add("translation")
				.setText(() => capture.translation || "")
				.setPlaceholder("translation-placeholder")
				.listeners.add(["change", "blur"], this.changeTextarea))
			.append(this.notes = new SortableList()
				.classes.add("notes")
				.listeners.add(SortableListEvent.SortComplete, () => this.emit("capture-change")))
			.appendTo(this);

		new Component()
			.classes.add("capture-action-row")
			.append(new Character(capture.character)
				.listeners.add("click", this.changeCharacter))
			.append(new Component("button")
				.setText("paste-notes")
				.listeners.add("click", this.pasteNotes))
			.append(new Component("button")
				.setText("remove")
				.listeners.add("click", () => this.emit("remove-capture")))
			.appendTo(this);

		(capture.notes && capture.notes.length ? capture.notes : [tuple("", "")])
			.forEach(this.addNote);
	}

	public getData (): CaptureData {
		const notes = this.notes.children<Note>()
			.filter(note => !note.isBlank())
			.map(note => note.getData())
			.collect(Collectors.toArray);

		return {
			...this.capture,
			notes: notes.length === 0 ? [["", ""]] : notes,
		};
	}

	public refreshImage () {
		this.img.attributes.set("src", this.img.attributes.get("src")! + "?cachebuster");
	}

	@Bound
	private async changeCharacter (event: Event) {
		Component.get<Character>(event).setCharacter(this.capture.character = await CharacterEditor.chooseCharacter(this.capture.character));
		this.emit("capture-change");
	}

	@Bound
	private async pasteNotes () {
		const text = await navigator.clipboard.readText();
		for (const [, note, translation] of (/- (.*?):(.*)/g).matches(text)) {
			this.addNote([note, translation]);
		}
	}

	@Bound
	private addNote (noteData?: [string, string]) {
		new Note(noteData)
			.listeners.add("note-change", this.noteChange)
			.listeners.add("note-blur", this.noteBlur)
			.appendTo(this.notes);
	}

	@Bound
	private noteChange (event: Event) {
		const note = Component.get<Note>(event);

		if (!note.isBlank()) {
			if (note.parent!.child(-1) === note) {
				this.addNote();
			}
		}

		this.emit("capture-change");
	}

	@Bound
	private noteBlur (event: Event) {
		const note = Component.get<Note>(event);
		const activeComponent = Component.get(document.activeElement!);
		if (activeComponent.isDescendantOf(note)) return;

		if (note.isBlank()) {
			if (note.parent!.child(-1) !== note) {
				note.remove();
			}
		}
	}

	@Bound
	private changeTextarea (event: Event) {
		const textarea = Component.get<Textarea>(event);
		this.capture[textarea.classes.has("japanese") ? "text" : "translation"] = textarea.getText();
		this.emit("capture-change");
	}
}

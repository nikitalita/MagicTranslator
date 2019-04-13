import Component, { TextGenerator } from "component/Component";

export default class LabelledRow extends Component {
	private readonly label: Component;

	public constructor (label: TextGenerator<Component>) {
		super();
		this.classes.add("labelled-row");
		this.label = new Component("label")
			.setText(label)
			.appendTo(this);
	}

	@Override @Bound public refreshText () {
		this.label.refreshText();
		return this;
	}
}

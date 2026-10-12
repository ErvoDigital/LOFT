import { Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() { return [{ tag: 'div[data-page-break]' }]; },
  renderHTML() { return ["div", { "data-page-break": "", class: "doc-page-break", role: "separator", "aria-label": "Page break" }]; },
  addCommands() {
    return {
      // Only allow breaks at document level. Inserting one inside a table or
      // list would make pagination ambiguous and can corrupt its structure.
      insertPageBreak: () => ({ state, chain }) => {
        if (state.selection.$from.depth !== 1 || state.selection.$to.depth !== 1) return false;
        return chain().insertContent({ type: this.name }).command(({ tr, dispatch }) => {
          if (dispatch) {
            const { $to } = tr.selection;
            // Inserting an atom at the end leaves a node selection on it.
            // Put the caret in a paragraph so typing cannot replace the break.
            if ($to.depth === 0) {
              if ($to.nodeAfter?.isTextblock) tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
              else {
                tr.insert($to.pos, state.schema.nodes.paragraph.create());
                tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
              }
            }
            tr.scrollIntoView();
          }
          return true;
        }).run();
      },
      addPage: () => ({ state, chain }) => chain().insertContentAt(state.doc.content.size, [{ type: this.name }, { type: "paragraph" }]).focus("end").run(),
    };
  },
  addKeyboardShortcuts() {
    return { "Mod-Enter": () => this.editor.commands.insertPageBreak() };
  },
});

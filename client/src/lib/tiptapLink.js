// Shared by DocumentToolbar's Link button and DocumentMenuBar's Insert >
// Link item so the prompt-based flow isn't duplicated.
export function promptForLink(editor) {
  const previous = editor.getAttributes("link").href;
  const url = window.prompt("Link URL", previous || "https://");
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

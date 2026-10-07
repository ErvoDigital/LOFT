export function fileFailure(error, action = "download") {
  const status = error?.response?.status || error?.status;
  const failure = (title, message, canRetry = true) => ({ title, message, canRetry, action });
  if (status === 401 && error?.fileSource !== "storage") {
    return failure("Sign in to open this file", "Your session has ended. Sign in again, then reopen the file.", false);
  }
  if (status === 403 && error?.fileSource !== "storage") {
    return failure("You don't have access to this file", "Ask the file owner or a workspace admin to give you access.", false);
  }
  if (status === 404 || status === 410 || error?.code === "FILE_MISSING") {
    return failure("This file is no longer available", "Refresh the file list. If it is still missing, ask the uploader to share it again.", false);
  }
  if ((status === 401 || status === 403) && error?.fileSource === "storage") {
    return failure("The file link is unavailable", "The link may have expired. Try again to request a fresh download link.");
  }
  if (error?.code === "FILE_NETWORK_ERROR" || error?.code === "ERR_NETWORK" || error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return failure(action === "preview" ? "Couldn't load the preview" : "Couldn't download the file", "Check your internet connection, then try again.");
  }
  if (status === 429) return failure("Please try again in a moment", "Too many file requests were made at once. Wait a moment, then try again.");
  if (status >= 500 || error?.code === "FILE_LINK_UNAVAILABLE") {
    return failure("The file is temporarily unavailable", "LOFT couldn't retrieve this file right now. Please try again in a moment.");
  }
  return action === "preview"
    ? failure("Preview unavailable", "We couldn't display this file here. Try the preview again, or download it to open it in another app.")
    : failure("Couldn't download the file", "Please try again. If the problem continues, ask the uploader to share the file again.");
}

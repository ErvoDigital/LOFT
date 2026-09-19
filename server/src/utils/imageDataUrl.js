import { z } from "zod";

// Avatars and workspace logos are stored as data URIs directly on their rows
// (see client/src/lib/avatarImage.js) rather than in object storage, the same
// approach already used for images embedded in documents: a plain <img src>
// can't send the Authorization header a presigned/proxied download route
// would need. Restricted to raster formats — an svg data URI can carry a
// <script>, which would run wherever the image is rendered.
const imageDataUrlPattern = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

// null clears the image; omitting the field leaves it unchanged.
export const imageDataUrlSchema = z.union([z.string().regex(imageDataUrlPattern).max(300000), z.null()]).optional();

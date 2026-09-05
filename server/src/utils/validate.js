// Wraps a Zod schema as Express middleware that validates req.body and
// replaces it with the parsed (and coerced/defaulted) result.
export function validateBody(schema) {
  return (req, res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

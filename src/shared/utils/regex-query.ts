export function regexQuery(keys: string[], value: string) {
  return keys.map((k) => ({
    [k]: { $regex: value, $options: "i" },
  }));
}

export function enumToMessage(enumType: any) {
  return {
    message: `Values must be one of ${Object.values(enumType).join(", ")}`,
  };
}

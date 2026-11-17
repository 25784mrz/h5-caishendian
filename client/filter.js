import { TEXT } from "./constants.js";

function isAllowed(ch) {
  return /[0-9]/u.test(ch) || /^\p{Script=Han}$/u.test(ch);
}

export function checkText(text, kind, bannedWords) {
  const chars = [...String(text ?? "")];
  if (chars.some((ch) => !isAllowed(ch))) return { ok: false, message: TEXT.charset };
  if (kind === "name" && (chars.length < 2 || chars.length > 6)) {
    return { ok: false, message: TEXT.nameLength };
  }
  if (kind === "wish" && (chars.length < 1 || chars.length > 20)) {
    return { ok: false, message: TEXT.wishLength };
  }
  if (bannedWords.some((word) => word && chars.length > 0 && String(text).includes(word))) {
    return { ok: false, message: TEXT.banned };
  }
  return { ok: true };
}

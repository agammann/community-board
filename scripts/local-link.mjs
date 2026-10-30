// Inspect the literal link text without contacting its target.
export function localLinkTarget(link, platform = process.platform) {
  if (platform === "win32") {
    if (/^\\\\\?\\[a-z]:\\/i.test(link)) return link.slice(4);
    if (/^(?:\\\\|\/\/|\\\?\?\\|\\\.\\)/.test(link)) {
      throw Error("Network and device file links are not allowed in public assets.");
    }
  } else if (link.startsWith("//")) {
    throw Error("Network file links are not allowed in public assets.");
  }
  return link;
}

// Vite's public-file middleware does not apply its usual Windows path checks.
export function unsafeWindowsSegment(segment) {
  return segment.includes(":") || /^[^~.]{1,6}~\d+(?:\.[^~.]{0,3})?$/i.test(segment);
}

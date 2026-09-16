import QRCode from "qrcode";

/** Returns a PNG data URL for the given text, styled in brand ink/paper. */
export async function makeQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 480,
    color: {
      dark: "#0B1F1E",
      light: "#F5F7F0",
    },
  });
}

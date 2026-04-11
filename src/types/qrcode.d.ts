declare module 'qrcode' {
  interface ToCanvasOptions {
    margin?: number
    width?: number
    color?: {
      dark?: string
      light?: string
    }
  }

  const QRCode: {
    toCanvas(canvas: HTMLCanvasElement, text: string, options?: ToCanvasOptions): Promise<void>
  }

  export default QRCode
}

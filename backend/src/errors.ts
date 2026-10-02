/** An error with an HTTP status, turned into a JSON response by the app's error handler */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const forbidden = (message: string) => new HttpError(403, message)
export const notFound = (message: string) => new HttpError(404, message)
export const conflict = (message: string) => new HttpError(409, message)

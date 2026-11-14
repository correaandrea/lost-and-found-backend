// NestJS 12 se publica solo como ESM y Jest (CommonJS) no puede cargarlo en Node 22.
// Para las pruebas unitarias se reemplazan los decoradores y excepciones por equivalentes mínimos.
export class HttpException extends Error {}
export class BadRequestException extends HttpException {}
export class NotFoundException extends HttpException {}
export class UnauthorizedException extends HttpException {}
export class ForbiddenException extends HttpException {}
export const Injectable = () => () => undefined;

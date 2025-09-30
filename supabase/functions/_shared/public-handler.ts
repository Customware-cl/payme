// Handler público que no requiere autenticación para verificaciones de webhook

export function createPublicHandler(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    // Para requests GET (verificación de webhook), no validar auth
    if (req.method === 'GET') {
      return handler(req);
    }

    // Para otros métodos, continuar con el handler normal
    return handler(req);
  };
}
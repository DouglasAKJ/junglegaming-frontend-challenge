// Minimal stubs for MSW's unused GraphQL and Set-Cookie jar imports in REST + Bearer token apps
export function parse() {
  return { kind: 'Document', definitions: [] };
}

export const OperationTypeNode = {
  QUERY: 'query',
  MUTATION: 'mutation',
  SUBSCRIPTION: 'subscription',
};

export class MemoryCookieStore {
  idx: Record<string, any> = {};
}

export class CookieJar {
  getCookiesSync() {
    return [];
  }
  async setCookie() {}
}

export const Cookie = {
  fromJSON() {
    return null;
  },
  parse() {
    return null;
  },
};

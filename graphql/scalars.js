import { GraphQLScalarType, Kind } from 'graphql';

/**
 * Custom Scalar para JSON
 * Permite pasar objetos JSON directamente en GraphQL
 */
export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Custom scalar type for JSON objects',

  // Serializar: de valor interno a respuesta GraphQL
  serialize(value) {
    if (value === null || value === undefined) {
      return null;
    }

    // Si ya es un objeto, devolverlo
    if (typeof value === 'object') {
      return value;
    }

    // Si es un string, intentar parsearlo
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new Error('Invalid JSON string');
      }
    }

    return value;
  },

  // Parsear: de input de query/mutation a valor interno
  parseValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object') {
      return value;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new Error('Invalid JSON string in input');
      }
    }

    return value;
  },

  // Parsear: de AST literal (en query string)
  parseLiteral(ast) {
    switch (ast.kind) {
      case Kind.STRING:
        try {
          return JSON.parse(ast.value);
        } catch (e) {
          throw new Error('Invalid JSON string in literal');
        }
      case Kind.OBJECT:
        return parseObject(ast);
      case Kind.LIST:
        return ast.values.map((value) => JSONScalar.parseLiteral(value));
      case Kind.INT:
      case Kind.FLOAT:
        return Number(ast.value);
      case Kind.BOOLEAN:
        return Boolean(ast.value);
      case Kind.NULL:
        return null;
      default:
        return null;
    }
  },
});

/**
 * Helper para parsear objetos AST
 */
function parseObject(ast) {
  const value = Object.create(null);
  ast.fields.forEach((field) => {
    value[field.name.value] = JSONScalar.parseLiteral(field.value);
  });
  return value;
}

/**
 * Custom Scalar para DateTime
 * Maneja fechas como ISO 8601 strings
 */
export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'Custom scalar type for DateTime (ISO 8601)',

  // Serializar: de Date a string ISO
  serialize(value) {
    if (value === null || value === undefined) {
      return null;
    }

    // Si es un Date object
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Si es un string que parece una fecha
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
      throw new Error('Invalid DateTime string');
    }

    // Si es un timestamp numérico
    if (typeof value === 'number') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
      throw new Error('Invalid DateTime timestamp');
    }

    throw new Error('Invalid DateTime value');
  },

  // Parsear: de input a Date
  parseValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
      throw new Error('Invalid DateTime input');
    }

    throw new Error('DateTime must be a string, number, or Date object');
  },

  // Parsear: de literal en query
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (!isNaN(date.getTime())) {
        return date;
      }
      throw new Error('Invalid DateTime literal');
    }

    if (ast.kind === Kind.INT) {
      const date = new Date(Number(ast.value));
      if (!isNaN(date.getTime())) {
        return date;
      }
      throw new Error('Invalid DateTime timestamp literal');
    }

    return null;
  },
});

export default {
  JSON: JSONScalar,
  DateTime: DateTimeScalar,
};

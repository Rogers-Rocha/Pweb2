import { ValidationError } from 'class-validator';

export interface FieldError {
  field: string;
  messages: string[];
}

/** Converte a árvore de ValidationError do class-validator em uma lista plana e legível. */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, messages: Object.values(e.constraints) }] : [];
    return [...own, ...flattenValidationErrors(e.children ?? [], field)];
  });
}

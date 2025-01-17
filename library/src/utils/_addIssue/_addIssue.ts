import {
  getGlobalMessage,
  getSchemaMessage,
  getSpecificMessage,
} from '../../storages/index.ts';
import type {
  BaseIssue,
  BaseSchema,
  BaseSchemaAsync,
  BaseTransformation,
  BaseTransformationAsync,
  BaseValidation,
  BaseValidationAsync,
  Config,
  Dataset,
  ErrorMessage,
  InferInput,
  InferIssue,
  IssuePathItem,
} from '../../types/index.ts';
import { _stringify } from '../_stringify/index.ts';

/**
 * Context type.
 */
type Context =
  | BaseSchema<unknown, unknown, BaseIssue<unknown>>
  | BaseSchemaAsync<unknown, unknown, BaseIssue<unknown>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | BaseValidation<any, unknown, BaseIssue<unknown>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | BaseValidationAsync<any, unknown, BaseIssue<unknown>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | BaseTransformation<any, unknown, BaseIssue<unknown>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | BaseTransformationAsync<any, unknown, BaseIssue<unknown>>;

/**
 * Other type.
 */
interface Other<TContext extends Context> {
  input?: unknown;
  expected?: string;
  received?: string;
  message?: ErrorMessage<InferIssue<TContext>>;
  path?: [IssuePathItem, ...IssuePathItem[]];
  issues?: [
    BaseIssue<InferInput<TContext>>,
    ...BaseIssue<InferInput<TContext>>[],
  ];
}

/**
 * Adds an issue to the dataset.
 *
 * @param context The issue context.
 * @param label The issue label.
 * @param dataset The input dataset.
 * @param config The configuration.
 * @param other The optional props.
 *
 * @internal
 */
export function _addIssue<const TContext extends Context>(
  context: TContext,
  label: string,
  dataset: Dataset<unknown, BaseIssue<unknown>>,
  config: Config<InferIssue<TContext>>,
  other?: Other<TContext>
): void {
  // Get expected and received string
  const input = other && 'input' in other ? other.input : dataset.value;
  // @ts-expect-error
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? _stringify(input);

  // Create issue object
  // Hint: The issue is deliberately not constructed with the spread operator
  // for performance reasons
  const issue: BaseIssue<unknown> = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${
      expected ? `Expected ${expected} but r` : 'R'
    }eceived ${received}`,
    // @ts-expect-error
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config.lang,
    abortEarly: config.abortEarly,
    abortPipeEarly: config.abortPipeEarly,
  };

  // Check if context is a schema
  const isSchema = context.kind === 'schema';

  // Get custom issue message
  const message =
    other?.message ??
    // @ts-expect-error
    context.message ??
    getSpecificMessage(context.reference, issue.lang) ??
    (isSchema ? getSchemaMessage(issue.lang) : null) ??
    config.message ??
    getGlobalMessage(issue.lang);

  // If custom message if specified, override default message
  if (message) {
    // @ts-expect-error
    issue.message = typeof message === 'function' ? message(issue) : message;
  }

  // If context is a schema, set typed to `false`
  if (isSchema) {
    dataset.typed = false;
  }

  // Add issue to dataset
  if (dataset.issues) {
    dataset.issues.push(issue);
  } else {
    dataset.issues = [issue];
  }
}

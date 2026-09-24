import ivm from 'isolated-vm';

const DEFAULT_MEMORY_LIMIT_MB = 16;
const DEFAULT_TIMEOUT_MS = 50;
const MAX_SCRIPT_LENGTH = 4000;

function createSandboxError(code, message, cause = null) {
  const error = new Error(message);
  error.code = code;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function normalizeSandboxError(error) {
  const message = String(error?.message ?? '');

  if (/timed out/i.test(message)) {
    return createSandboxError(
      'SANDBOX_TIMEOUT',
      'The transformation exceeded the allowed execution time.',
      error,
    );
  }

  if (
    error instanceof SyntaxError ||
    /SyntaxError/i.test(message) ||
    /Unexpected token/i.test(message)
  ) {
    return createSandboxError(
      'SANDBOX_SYNTAX_ERROR',
      'The transformation contains invalid JavaScript syntax.',
      error,
    );
  }

  return createSandboxError(
    'SANDBOX_EXECUTION_ERROR',
    message || 'The sandboxed transformation failed.',
    error,
  );
}

function validateSourceCode(sourceCode) {
  if (typeof sourceCode !== 'string') {
    throw createSandboxError(
      'SANDBOX_CODE_REQUIRED',
      'Transformation code must be a JavaScript string.',
    );
  }

  const normalized = sourceCode.trim();

  if (!normalized) {
    throw createSandboxError(
      'SANDBOX_CODE_REQUIRED',
      'Transformation code cannot be empty.',
    );
  }

  if (normalized.length > MAX_SCRIPT_LENGTH) {
    throw createSandboxError(
      'SANDBOX_CODE_TOO_LARGE',
      `Transformation code cannot exceed ${MAX_SCRIPT_LENGTH} characters.`,
    );
  }

  return normalized;
}

export class SandboxProgram {
  constructor({
    sourceCode,
    memoryLimitMb = DEFAULT_MEMORY_LIMIT_MB,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }) {
    this.sourceCode = validateSourceCode(sourceCode);

    this.memoryLimitMb = Math.max(
      8,
      Number(memoryLimitMb) || DEFAULT_MEMORY_LIMIT_MB,
    );

    this.timeoutMs = Math.max(
      10,
      Math.min(
        1000,
        Number(timeoutMs) || DEFAULT_TIMEOUT_MS,
      ),
    );

    this.isolate = null;
    this.context = null;
    this.functionReference = null;
    this.disposed = false;
  }

  async initialize() {
    if (this.functionReference) {
      return this;
    }

    try {
      this.isolate = new ivm.Isolate({
        memoryLimit: this.memoryLimitMb,
      });

      this.context =
        await this.isolate.createContext();

      /*
       * isolated-vm contexts do not receive
       * Node.js globals automatically.
       *
       * These explicit assignments document
       * and enforce the capabilities that must
       * remain unavailable to user scripts.
       */
      await this.context.eval(`
        globalThis.process = undefined;
        globalThis.require = undefined;
        globalThis.module = undefined;
        globalThis.exports = undefined;
        globalThis.Buffer = undefined;
        globalThis.fetch = undefined;
        globalThis.WebSocket = undefined;
        globalThis.XMLHttpRequest = undefined;
      `);

      const wrapper = `
        (
          function(value, row) {
            "use strict";

            ${this.sourceCode}
          }
        )
      `;

      const script =
        await this.isolate.compileScript(
          wrapper,
        );

      this.functionReference =
        await script.run(
          this.context,
          {
            timeout: this.timeoutMs,
          },
        );

      return this;
    } catch (error) {
      this.dispose();
      throw normalizeSandboxError(error);
    }
  }

  async execute(value, row = {}) {
  if (this.disposed) {
    throw createSandboxError(
      'SANDBOX_DISPOSED',
      'This sandbox instance has already been disposed.',
    );
  }

  if (!this.context) {
    await this.initialize();
  }

  try {
    return await this.context.evalClosure(
      `
        const transform = (
          function(value, row) {
            "use strict";

            ${this.sourceCode}
          }
        );

        return transform($0, $1);
      `,
      [
        new ivm.ExternalCopy(value).copyInto(),
        new ivm.ExternalCopy(row).copyInto(),
      ],
      {
        timeout: this.timeoutMs,

        arguments: {
          copy: true,
        },

        result: {
          copy: true,
        },
      },
    );
  } catch (error) {
    throw normalizeSandboxError(error);
  }
}

  dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    try {
      this.functionReference?.release();
    } catch {
      // Best-effort cleanup.
    }

    try {
      this.context?.release();
    } catch {
      // Best-effort cleanup.
    }

    try {
      this.isolate?.dispose();
    } catch {
      // Best-effort cleanup.
    }

    this.functionReference = null;
    this.context = null;
    this.isolate = null;
  }
}

export async function executeSandboxTransformation({
  sourceCode,
  value,
  row = {},
  memoryLimitMb = DEFAULT_MEMORY_LIMIT_MB,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const program =
    new SandboxProgram({
      sourceCode,
      memoryLimitMb,
      timeoutMs,
    });

  try {
    await program.initialize();

    return await program.execute(
      value,
      row,
    );
  } finally {
    program.dispose();
  }
}

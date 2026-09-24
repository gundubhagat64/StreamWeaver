import {
  Transform,
} from 'node:stream';

import {
  SandboxProgram,
} from '../services/sandboxService.js';

const FIELD_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*$/;

const MAX_TRANSFORMATIONS = 100;

function normalizeTransformations(
  transformations,
) {
  if (
    !Array.isArray(
      transformations,
    )
  ) {
    throw new Error(
      'Transformations must be an array.',
    );
  }

  if (
    transformations.length >
    MAX_TRANSFORMATIONS
  ) {
    throw new Error(
      `A maximum of ${MAX_TRANSFORMATIONS} transformations is supported.`,
    );
  }

  return transformations.map(
    (transformation, index) => {
      const field =
        String(
          transformation?.field ?? '',
        ).trim();

      const code =
        String(
          transformation?.code ?? '',
        ).trim();

      if (
        !FIELD_PATTERN.test(field)
      ) {
        throw new Error(
          `Transformation ${index + 1} contains an invalid field name.`,
        );
      }

      if (!code) {
        throw new Error(
          `Transformation ${index + 1} does not contain JavaScript code.`,
        );
      }

      return {
        field,
        code,
      };
    },
  );
}

export class SandboxTransform extends Transform {
  constructor({
    transformations = [],
    memoryLimitMb = 16,
    timeoutMs = 50,
  } = {}) {
    super({
      writableObjectMode: true,
      readableObjectMode: true,
    });

    this.transformations =
      normalizeTransformations(
        transformations,
      );

    this.memoryLimitMb =
      memoryLimitMb;

    this.timeoutMs =
      timeoutMs;

    this.programs = [];
  }

  _construct(callback) {
    this.initialize()
      .then(() => callback())
      .catch(callback);
  }

  async initialize() {
    for (
      const transformation
      of this.transformations
    ) {
      const program =
        new SandboxProgram({
          sourceCode:
            transformation.code,

          memoryLimitMb:
            this.memoryLimitMb,

          timeoutMs:
            this.timeoutMs,
        });

      await program.initialize();

      this.programs.push({
        field:
          transformation.field,

        program,
      });
    }
  }

  _transform(
    row,
    _encoding,
    callback,
  ) {
    this.transformRow(row)
      .then(
        (result) =>
          callback(
            null,
            result,
          ),
      )
      .catch(callback);
  }

  async transformRow(row) {
    const data =
      Object.assign(
        Object.create(null),
        row?.data ?? {},
      );

    for (
      const {
        field,
        program,
      } of this.programs
    ) {
      const currentValue =
        data[field];

      data[field] =
        await program.execute(
          currentValue,
          data,
        );
    }

    return {
      ...row,
      data,
    };
  }

  _destroy(
    error,
    callback,
  ) {
    for (
      const { program }
      of this.programs
    ) {
      program.dispose();
    }

    this.programs = [];

    callback(error);
  }
}

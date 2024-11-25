import { isEqual as _isEqual } from "lodash";

export function getDifferences<T extends object>(
  object1: T,
  object2: T
): {
  changes: {
    [key in keyof T]?: {
      from: string;
      to: string;
    };
  };
} {
  let differences: {
    [key in keyof T]?: {
      from: string;
      to: string;
    };
  } = {};

  // Loop through each key and compare the values
  Object.keys(object1).forEach((key) => {
    const typedKey = key as keyof T; // Type assertion for strict key typing
    if (!_isEqual(object1[typedKey], object2[typedKey])) {
      differences[typedKey] = {
        from: JSON.stringify(object1[typedKey]),
        to: JSON.stringify(object2[typedKey]),
      };
    }
  });

  return { changes: differences };
}

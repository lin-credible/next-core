import { PluginRuntimeContext } from "@easyops/brick-types";
import { isObject, inject } from "@easyops/brick-utils";

export const computeRealValue = (
  value: any,
  context: PluginRuntimeContext,
  injectDeep?: boolean
): any => {
  if (typeof value === "string") {
    return inject(value, context);
  }

  let newValue = value;
  if (injectDeep && isObject(value)) {
    if (Array.isArray(value)) {
      newValue = value.map(v => computeRealValue(v, context, injectDeep));
    } else {
      newValue = Object.entries(value).reduce<Record<string, any>>(
        (acc, [k, v]) => {
          k = computeRealValue(k, context, false);
          acc[k] = computeRealValue(v, context, injectDeep);
          return acc;
        },
        {}
      );
    }
  }

  return newValue;
};

export function setProperties(
  bricks: HTMLElement | HTMLElement[],
  properties: Record<string, any>,
  context: PluginRuntimeContext,
  injectDeep?: boolean
): void {
  const realProps = computeRealProperties(properties, context, injectDeep);
  if (!Array.isArray(bricks)) {
    bricks = [bricks];
  }
  bricks.forEach(brick => {
    setRealProperties(brick, realProps);
  });
}

export function setRealProperties(
  brick: HTMLElement,
  realProps: Record<string, any>
): void {
  for (const [propName, propValue] of Object.entries(realProps)) {
    if (propName === "style") {
      for (const [styleName, styleValue] of Object.entries(propValue)) {
        (brick.style as any)[styleName] = styleValue;
      }
    } else {
      (brick as any)[propName] = propValue;
    }
  }
}

export function computeRealProperties(
  properties: Record<string, any>,
  context: PluginRuntimeContext,
  injectDeep?: boolean
): any {
  const result: Record<string, any> = {};

  if (isObject(properties)) {
    for (const [propName, propValue] of Object.entries(properties)) {
      if (propName === "style") {
        if (isObject(propValue)) {
          result.style = propValue;
        }
      } else {
        // Related: https://github.com/facebook/react/issues/11347
        const realValue = computeRealValue(propValue, context, injectDeep);
        if (realValue !== undefined) {
          result[propName] = realValue;
        }
      }
    }
  }

  return result;
}
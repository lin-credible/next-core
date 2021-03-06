import { History } from "history";
import {
  PluginHistoryState,
  ExtendedHistory,
  UpdateQueryFunction,
  UpdateQueryOptions,
  UpdateAnchorFunction,
} from "@next-core/brick-types";

export function historyExtended(
  browserHistory: History<PluginHistoryState>
): ExtendedHistory {
  function updateQueryFactory(method: "push" | "replace"): UpdateQueryFunction {
    return function updateQuery(
      query: Record<string, any>,
      options: UpdateQueryOptions = {}
    ): void {
      const { extraQuery, clear, ...state } = options;
      const urlSearchParams = new URLSearchParams(
        clear ? "" : browserHistory.location.search
      );
      const params: Record<string, any> = {};
      Object.assign(params, query, extraQuery);
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          urlSearchParams.delete(key);
          for (const item of value) {
            urlSearchParams.append(key, item);
          }
        } else if (value === undefined || value === null || value === "") {
          urlSearchParams.delete(key);
        } else {
          urlSearchParams.set(key, value);
        }
      }
      browserHistory[method](`?${urlSearchParams.toString()}`, state);
    };
  }

  function updateAnchorFactory(
    method: "push" /* | "replace" */
  ): UpdateAnchorFunction {
    return function updateAnchor(
      hash: string,
      state?: PluginHistoryState
    ): void {
      browserHistory[method]({
        ...browserHistory.location,
        key: undefined,
        hash,
        state: {
          // The default notify is false
          notify: false,
          ...state,
        },
      });
    };
  }

  function reload(): void {
    browserHistory.replace({
      ...browserHistory.location,
      state: {
        ...browserHistory.location.state,
        // Always notify
        notify: true,
      },
    });
  }

  let blockMessage: string;

  function setBlockMessage(message: string): void {
    blockMessage = message;
  }

  function getBlockMessage(): string {
    return blockMessage;
  }

  function unblock(): void {
    blockMessage = undefined;
  }

  return {
    pushQuery: updateQueryFactory("push"),
    replaceQuery: updateQueryFactory("replace"),
    pushAnchor: updateAnchorFactory("push"),
    // replaceAnchor: updateAnchorFactory("replace"),
    reload,
    setBlockMessage,
    getBlockMessage,
    unblock,
  };
}

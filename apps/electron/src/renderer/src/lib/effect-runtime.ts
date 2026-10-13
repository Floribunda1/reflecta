import { Context, Layer, ManagedRuntime } from "effect";

import { RpcClient, type RpcClientError } from "effect/rpc";
import { RendererRpcClient } from "electron-effect-rpc/renderer";
import { AppRpcs } from "../../../ipc";

/** Renderer IPC 服务与所有 query / mutation 共用一个 app-lifetime runtime。 */
export class AppApi extends Context.Service<
  AppApi,
  RpcClient.FromGroup<typeof AppRpcs, RpcClientError.RpcClientError>
>()("reflecta/AppApi") {
  static readonly layer = Layer.effect(AppApi)(RpcClient.make(AppRpcs)).pipe(
    Layer.provide(RendererRpcClient.layerProtocol()),
  );
}

export const AppLayer = AppApi.layer;

export const AppRuntime = ManagedRuntime.make(AppLayer);

/** 在非 Effect 侧跑一个 renderer 程序（Promise 形态）。 */
export const runPromise = AppRuntime.runPromise.bind(AppRuntime);

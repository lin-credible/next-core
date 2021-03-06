const modifyResponse = require("./modifyResponse");
const {
  getSingleBrickPackage,
  getSingleStoryboard,
  getSingleTemplatePackage,
  getSettings,
  mergeSettings,
  getUserSettings,
  getDevSettings,
} = require("./utils");
const fs = require("fs");
const path = require("path");

module.exports = (env) => {
  const {
    useOffline,
    useSubdir,
    useRemote,
    publicPath,
    localBrickPackages,
    localEditorPackages,
    localMicroApps,
    localTemplates,
    useLocalSettings,
    useMergeSettings,
    server,
    mockedMicroApps,
    brickPackagesDir,
  } = env;

  const pathRewriteFactory = (seg) =>
    useSubdir
      ? undefined
      : {
          [`^/${seg}`]: `/next/${seg}`,
        };

  const proxyPaths = ["api"];
  const apiProxyOptions = {
    headers: {
      "dev-only-login-page": `http://${env.host}:${env.port}${publicPath}auth/login`,
    },
  };
  if (useRemote) {
    proxyPaths.push("bricks", "micro-apps", "templates");
    apiProxyOptions.onProxyRes = (proxyRes, req, res) => {
      // 设定透传远端请求时，可以指定特定的 brick-packages, micro-apps, templates 使用本地文件。
      if (
        req.path === "/next/api/auth/bootstrap" ||
        req.path === "/api/auth/bootstrap"
      ) {
        modifyResponse(res, proxyRes, (raw) => {
          if (res.statusCode !== 200) {
            return raw;
          }
          const result = JSON.parse(raw);
          const { data } = result;
          if (localMicroApps.length > 0 || mockedMicroApps.length > 0) {
            data.storyboards = mockedMicroApps
              .map((id) =>
                getSingleStoryboard(env, id, true, {
                  brief: true,
                })
              )
              .concat(
                localMicroApps.map((id) =>
                  getSingleStoryboard(env, id, false, {
                    brief: true,
                  })
                )
              )
              .filter(Boolean)
              .concat(
                data.storyboards.filter(
                  (item) => !(item.app && localMicroApps.includes(item.app.id))
                )
              );
          }
          const combinedLocalBrickPackages = Array.from(
            new Set(localBrickPackages.concat(localEditorPackages))
          );
          if (combinedLocalBrickPackages.length > 0) {
            data.brickPackages = combinedLocalBrickPackages
              .map((id) => getSingleBrickPackage(env, id, data.brickPackages))
              .filter(Boolean)
              .concat(
                data.brickPackages.filter(
                  (item) =>
                    !combinedLocalBrickPackages.includes(
                      item.filePath.split("/")[1]
                    )
                )
              );
          }
          if (localTemplates.length > 0) {
            data.templatePackages = localTemplates
              .map((id) => getSingleTemplatePackage(env, id))
              .filter(Boolean)
              .concat(
                data.templatePackages.filter(
                  (item) =>
                    !localTemplates.includes(item.filePath.split("/")[1])
                )
              );
          }
          if (useLocalSettings) {
            data.settings = getSettings();
          } else {
            data.settings = mergeSettings(data.settings, getDevSettings());
            if (useMergeSettings) {
              data.settings = mergeSettings(data.settings, getUserSettings());
            }
          }
          return JSON.stringify(result);
        });
      } else if (
        req.path ===
          "/next/api/gateway/next_builder.build.GetStoriesJson/api/v1/next-builder/storiesjson" ||
        req.path ===
          "/api/gateway/next_builder.build.GetStoriesJson/api/v1/next-builder/storiesjson"
      ) {
        modifyResponse(res, proxyRes, (raw) => {
          if (res.statusCode !== 200) {
            return raw;
          }
          const result = JSON.parse(raw);
          const { data } = result;
          localBrickPackages.forEach((pkgId) => {
            const filePath = path.join(
              brickPackagesDir,
              pkgId,
              "dist",
              "stories.json"
            );

            if (fs.existsSync(filePath)) {
              const story = JSON.parse(fs.readFileSync(filePath, "utf-8"));
              data.list = [
                ...data.list.filter(
                  (v) => !story.some((s) => s.storyId === v.storyId)
                ),
                ...story,
              ];
            }
          });

          return JSON.stringify(result);
        });
      }
    };
  }

  return useOffline
    ? undefined
    : {
        [`${publicPath}api/websocket_service`]: {
          target: server,
          secure: false,
          changeOrigin: true,
          ws: true,
          headers: {
            Origin: server,
            referer: server,
          },
          pathRewrite: pathRewriteFactory("api/websocket_service"),
        },
        ...proxyPaths.reduce((acc, seg) => {
          acc[`${publicPath}${seg}`] = {
            target: server,
            secure: false,
            changeOrigin: true,
            pathRewrite: pathRewriteFactory(seg),
            ...(seg === "api" ? apiProxyOptions : {}),
          };
          return acc;
        }, {}),
      };
};

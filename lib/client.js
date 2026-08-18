window.__ModuleLoader__.load({
  id: "@dsh-external/dsh-plugin-market",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    //#region dsh-plugin-market client half
    var React = require("react");

    // 注入样式（随 bundle 生效）
    (function () {
      var css = [
        ".dshm { display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; font-size: 13px; color: var(--dsw-alias-label-primary); height: 100%; box-sizing: border-box; overflow: auto; }",
        ".dshm-search { display: flex; gap: 8px; }",
        ".dshm-input { flex: 1; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); outline: none; }",
        ".dshm-input:focus { border-color: var(--dsw-alias-brand-primary); }",
        ".dshm-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; font-weight: 500; }",
        ".dshm-btn:hover { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); }",
        // 主按钮文字永远用 label-primary（主题保证与 bg-layer-2 的对比），
        // 品牌色只做边框与 hover，避免某些主题下品牌色背景与文字对比不足导致看不见字。
        ".dshm-btn-primary { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); font-weight: 600; }",
        ".dshm-btn:disabled { opacity: .55; cursor: default; }",
        ".dshm-list { display: flex; flex-direction: column; gap: 8px; }",
        ".dshm-card { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); cursor: pointer; }",
        ".dshm-card:hover { border-color: var(--dsw-alias-border-l2); }",
        ".dshm-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
        ".dshm-name { font-weight: 600; }",
        ".dshm-badge { padding: 1px 7px; border-radius: 999px; font-size: 11px; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }",
        ".dshm-badge-live { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }",
        ".dshm-badge-kind { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }",
        ".dshm-badge-installed { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }",
        ".dshm-filters { display: flex; gap: 8px; flex-wrap: wrap; }",
        ".dshm-tabs { display: flex; gap: 8px; }",
        ".dshm-tab { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); cursor: pointer; font-weight: 500; }",
        ".dshm-tab-active { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); font-weight: 600; }",
        ".dshm-manage-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
        ".dshm-manage-row { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }",
        ".dshm-manage-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }",
        ".dshm-btn-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }",
        ".dshm-up-new { color: var(--dsw-alias-state-warn-primary); }",
        ".dshm-up-fresh { color: var(--dsw-alias-state-success-primary); }",
        ".dshm-up-err { color: var(--dsw-alias-state-error-primary); }",
        ".dshm-select { padding: 5px 8px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); outline: none; font-size: 12px; }",
        ".dshm-select:focus { border-color: var(--dsw-alias-brand-primary); }",
        ".dshm-desc { color: var(--dsw-alias-label-secondary); line-height: 1.5; }",
        ".dshm-meta { display: flex; gap: 12px; color: var(--dsw-alias-label-secondary); font-size: 12px; }",
        ".dshm-error { color: var(--dsw-alias-state-error-primary); }",
        ".dshm-note { color: var(--dsw-alias-state-warn-primary); }",
        ".dshm-ok { color: var(--dsw-alias-state-success-primary); }",
        ".dshm-detail { display: flex; flex-direction: column; gap: 10px; }",
        ".dshm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; color: var(--dsw-alias-label-secondary); }",
        ".dshm-pre { margin: 0; padding: 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); white-space: pre-wrap; word-break: break-all; max-height: 260px; overflow: auto; font-size: 12px; }",
        ".dshm-file { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px dashed var(--dsw-alias-border-l1); }",
        ".dshm-back { align-self: flex-start; }",
        ".dshm-status { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }",
        ".dshm-more { align-self: center; }",
        ".dshm-auth { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
        ".dshm-login { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }",
        ".dshm-token { flex: 1; min-width: 200px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); outline: none; }",
        ".dshm-token:focus { border-color: var(--dsw-alias-brand-primary); }",
        ".dshm-proxy { flex: 1; min-width: 200px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); outline: none; }",
        ".dshm-proxy:focus { border-color: var(--dsw-alias-brand-primary); }",
        ".dshm-md h1, .dshm-md h2, .dshm-md h3 { margin: 8px 0 4px; line-height: 1.3; }",
        ".dshm-md h1 { font-size: 15px; }",
        ".dshm-md h2 { font-size: 14px; }",
        ".dshm-md h3 { font-size: 13px; }",
        ".dshm-md p { margin: 4px 0; line-height: 1.6; }",
        ".dshm-md ul { margin: 4px 0; padding-left: 18px; }",
        ".dshm-md li { margin: 2px 0; }",
        ".dshm-md code { background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); border-radius: 4px; padding: 0 4px; font-size: 12px; }",
        ".dshm-md pre { margin: 6px 0; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); overflow: auto; font-size: 12px; white-space: pre; }",
        ".dshm-md a { color: var(--dsw-alias-brand-primary); }",
      ].join("\n");
      var style = document.createElement("style");
      style.setAttribute("data-plugin", "dsh-plugin-market");
      style.textContent = css;
      document.head.appendChild(style);
    })();

    // Client → Host：环回 HTTP API（webServer /market-api 前缀路由）
    function callApi(name, args) {
      return fetch("/market-api/" + name, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args || {}),
      }).then(function (r) { return r.json(); });
    }

    // 把 README 里的相对链接/锚点解析为 GitHub 上的真实地址（否则浏览器会解析为
    // 指向当前 dsh 页面的相对 URL）
    function resolveLinkHref(href, linkBase) {
      if (!linkBase || typeof href !== "string" || !href) return href;
      if (/^(https?:|mailto:|tel:|ftp:|data:)/i.test(href)) return href;
      var base = linkBase.repoUrl || ("https://github.com/" + linkBase.fullName + "/blob/" + linkBase.branch + "/");
      if (href.charAt(0) === "#") {
        return base + (linkBase.readmePath || "README.md") + href;
      }
      var clean = href.split("#")[0].split("?")[0];
      if (!clean) return href;
      var dir = (linkBase.readmePath || "README.md").indexOf("/") >= 0 ? (linkBase.readmePath || "README.md").split("/").slice(0, -1).join("/") : "";
      var joined = (dir ? dir + "/" : "") + clean.replace(/^\.\//, "");
      var parts = joined.split("/");
      var stack = [];
      for (var i = 0; i < parts.length; i += 1) {
        if (parts[i] === "..") { if (stack.length) stack.pop(); }
        else if (parts[i] === "." || parts[i] === "") { /* skip */ }
        else stack.push(parts[i]);
      }
      var anchor = href.indexOf("#") >= 0 ? href.slice(href.indexOf("#")) : "";
      return base + stack.join("/") + anchor;
    }

    function inlineMd(text, keyBase, linkBase) {
      var out = [];
      var parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g);
      for (var i = 0; i < parts.length; i += 1) {
        var p = parts[i];
        if (!p) continue;
        if (/^\*\*[^*]+\*\*$/.test(p)) {
          out.push(React.createElement("strong", { key: keyBase + "-" + i }, p.slice(2, -2)));
        } else if (/^`[^`]+`$/.test(p)) {
          out.push(React.createElement("code", { key: keyBase + "-" + i }, p.slice(1, -1)));
        } else if (/^\[[^\]]+\]\([^)]+\)$/.test(p)) {
          var m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
          out.push(React.createElement("a", { key: keyBase + "-" + i, href: resolveLinkHref(m[2], linkBase), target: "_blank", rel: "noreferrer" }, m[1]));
        } else {
          out.push(p);
        }
      }
      return out;
    }

    function renderMarkdown(text, linkBase) {
      var lines = String(text || "").split(/\r?\n/);
      var nodes = [];
      var inCode = false;
      var codeBuf = [];
      var listBuf = [];
      function flushList(k) {
        if (listBuf.length) {
          nodes.push(React.createElement("ul", { key: k }, listBuf.map(function (li, i) { return React.createElement("li", { key: k + "-" + i }, inlineMd(li, k + "-li" + i, linkBase)); })));
          listBuf = [];
        }
      }
      var idx = 0;
      for (var ri = 0; ri < lines.length; ri += 1) {
        idx += 1;
        var line = lines[ri].trimEnd();
        if (line.indexOf("```") === 0) {
          if (inCode) {
            nodes.push(React.createElement("pre", { key: idx }, codeBuf.join("\n")));
            codeBuf = [];
            inCode = false;
          } else {
            flushList("ul-" + idx);
            inCode = true;
          }
          continue;
        }
        if (inCode) { codeBuf.push(line); continue; }
        var h = /^(#{1,3})\s+(.*)$/.exec(line);
        if (h) {
          flushList("ul-" + idx);
          var level = h[1].length;
          nodes.push(React.createElement(level === 1 ? "h1" : level === 2 ? "h2" : "h3", { key: idx }, inlineMd(h[2], "h" + idx, linkBase)));
          continue;
        }
        if (/^[-*]\s+/.test(line)) { listBuf.push(line.replace(/^[-*]\s+/, "")); continue; }
        flushList("ul-" + idx);
        if (!line.trim()) continue;
        nodes.push(React.createElement("p", { key: idx }, inlineMd(line, "p" + idx, linkBase)));
      }
      flushList("ul-end");
      if (inCode) nodes.push(React.createElement("pre", { key: "code-end" }, codeBuf.join("\n")));
      return React.createElement("div", { className: "dshm-md" }, nodes);
    }

    function MarketPage(props) {
      var inputActions = props && props.inputActions;
      var state = React.useState("");
      var query = state[0], setQuery = state[1];
      var statePage = React.useState(1);
      var page = statePage[0], setPage = statePage[1];
      var stateItems = React.useState(null);
      var items = stateItems[0], setItems = stateItems[1];
      var stateLoading = React.useState(false);
      var loading = stateLoading[0], setLoading = stateLoading[1];
      var stateLoadingMore = React.useState(false);
      var loadingMore = stateLoadingMore[0], setLoadingMore = stateLoadingMore[1];
      var stateHasMore = React.useState(false);
      var hasMore = stateHasMore[0], setHasMore = stateHasMore[1];
      var stateError = React.useState(null);
      var error = stateError[0], setError = stateError[1];
      var stateNote = React.useState(null);
      var note = stateNote[0], setNote = stateNote[1];
      var stateAuth = React.useState(null);
      var auth = stateAuth[0], setAuth = stateAuth[1];
      var stateLogin = React.useState(null);
      var login = stateLogin[0], setLogin = stateLogin[1];
      var stateQuota = React.useState(null);
      var quota = stateQuota[0], setQuota = stateQuota[1];
      var stateProxy = React.useState(null);
      var proxy = stateProxy[0], setProxy = stateProxy[1];
      var stateProxyOpen = React.useState(false);
      var proxyOpen = stateProxyOpen[0], setProxyOpen = stateProxyOpen[1];
      var stateProxyInput = React.useState("");
      var proxyInput = stateProxyInput[0], setProxyInput = stateProxyInput[1];
      var stateProxyBusy = React.useState(false);
      var proxyBusy = stateProxyBusy[0], setProxyBusy = stateProxyBusy[1];
      var stateProxyMsg = React.useState(null);
      var proxyMsg = stateProxyMsg[0], setProxyMsg = stateProxyMsg[1];
      var stateLoginOpen = React.useState(false);
      var loginOpen = stateLoginOpen[0], setLoginOpen = stateLoginOpen[1];
      var stateTokenInput = React.useState("");
      var tokenInput = stateTokenInput[0], setTokenInput = stateTokenInput[1];
      var stateAuthBusy = React.useState(false);
      var authBusy = stateAuthBusy[0], setAuthBusy = stateAuthBusy[1];
      var stateAuthMsg = React.useState(null);
      var authMsg = stateAuthMsg[0], setAuthMsg = stateAuthMsg[1];
      var stateSelected = React.useState(null);
      var selected = stateSelected[0], setSelected = stateSelected[1];
      var stateDetail = React.useState(null);
      var detail = stateDetail[0], setDetail = stateDetail[1];
      var stateDetailLoading = React.useState(false);
      var detailLoading = stateDetailLoading[0], setDetailLoading = stateDetailLoading[1];
      var stateInstall = React.useState(null);
      var install = stateInstall[0], setInstall = stateInstall[1];
      var stateFilterSource = React.useState("");
      var filterSource = stateFilterSource[0], setFilterSource = stateFilterSource[1];
      var stateFilterLang = React.useState("");
      var filterLang = stateFilterLang[0], setFilterLang = stateFilterLang[1];
      var stateSortBy = React.useState("stars");
      var sortBy = stateSortBy[0], setSortBy = stateSortBy[1];
      var stateRefreshing = React.useState(false);
      var refreshing = stateRefreshing[0], setRefreshing = stateRefreshing[1];
      var stateView = React.useState("market");
      var view = stateView[0], setView = stateView[1];
      var stateManaged = React.useState(null);
      var managed = stateManaged[0], setManaged = stateManaged[1];
      var stateManageBusy = React.useState(false);
      var manageBusy = stateManageBusy[0], setManageBusy = stateManageBusy[1];
      var stateManageMsg = React.useState(null);
      var manageMsg = stateManageMsg[0], setManageMsg = stateManageMsg[1];
      var stateUninstallArm = React.useState(null);
      var uninstallArm = stateUninstallArm[0], setUninstallArm = stateUninstallArm[1];
      var stateRemoveArm = React.useState(null);
      var removeArm = stateRemoveArm[0], setRemoveArm = stateRemoveArm[1];
      var stateManageSelected = React.useState(null);
      var manageSelected = stateManageSelected[0], setManageSelected = stateManageSelected[1];
      var stateManageDetail = React.useState(null);
      var manageDetail = stateManageDetail[0], setManageDetail = stateManageDetail[1];
      var stateManageDetailLoading = React.useState(false);
      var manageDetailLoading = stateManageDetailLoading[0], setManageDetailLoading = stateManageDetailLoading[1];
      var stateCheckNames = React.useState({});
      var checkNames = stateCheckNames[0], setCheckNames = stateCheckNames[1];
      var stateUpdatingName = React.useState(null);
      var updatingName = stateUpdatingName[0], setUpdatingName = stateUpdatingName[1];
      var stateCopiedCmd = React.useState(null);
      var copiedCmd = stateCopiedCmd[0], setCopiedCmd = stateCopiedCmd[1];

      function copyCmd(cmd) {
        try {
          if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(cmd).then(function () {
              setCopiedCmd(cmd);
              setTimeout(function () { setCopiedCmd(null); }, 2000);
            }, function () { setCopiedCmd(null); });
          }
        } catch (e) { setCopiedCmd(null); }
      }

      React.useEffect(function () {
        runSearch("");
        callApi("config/get", {}).then(function (res) {
          if (res && typeof res.proxy === "string" && res.proxy) setProxy(res.proxy);
        }, function () {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      function runSearch(q, force) {
        setLoading(true);
        setRefreshing(!!force);
        setError(null);
        setNote(null);
        setSelected(null);
        setDetail(null);
        setInstall(null);
        setPage(1);
        callApi("search", { query: q, page: 1, refresh: !!force }).then(function (res) {
          setItems((res && res.items) || []);
          setHasMore(!!(res && res.hasMore));
          if (res && res.auth) setAuth(res.auth);
          if (res && res.login) setLogin(res.login);
          if (res && res.quota) setQuota(res.quota);
          if (res && res.error) setError(res.error);
          if (res && res.throttled && res.note) setNote(res.note);
        }, function (err) {
          setItems([]);
          setHasMore(false);
          setError(String((err && err.message) || err));
        }).then(function () { setLoading(false); setRefreshing(false); });
      }

      function loadMore() {
        if (loadingMore || !hasMore) return;
        var next = page + 1;
        setLoadingMore(true);
        callApi("search", { query: query, page: next }).then(function (res) {
          var more = (res && res.items) || [];
          if (more.length) {
            var seen = new Set();
            var merged = (items || []).concat(more).filter(function (it) {
              if (seen.has(it.fullName)) return false;
              seen.add(it.fullName);
              return true;
            });
            setItems(merged);
          }
          setPage(next);
          setHasMore(!!(res && res.hasMore));
          if (res && res.auth) setAuth(res.auth);
          if (res && res.login) setLogin(res.login);
          if (res && res.quota) setQuota(res.quota);
          if (res && res.throttled && res.note) setNote(res.note);
          if (res && res.error) setError(res.error);
        }, function (err) {
          setError(String((err && err.message) || err));
        }).then(function () { setLoadingMore(false); });
      }

      function doLogin() {
        var t = tokenInput.trim();
        if (!t || authBusy) return;
        setAuthBusy(true);
        setAuthMsg(null);
        callApi("auth/login", { token: t }).then(function (res) {
          if (res && res.ok) {
            setAuth("token");
            setLogin(res.login || null);
            setQuota(null);
            setLoginOpen(false);
            setTokenInput("");
            setAuthMsg({ ok: true, text: "已登录：@" + (res.login || "") });
          } else {
            setAuthMsg({ ok: false, text: (res && res.error) || "登录失败" });
          }
        }, function (err) {
          setAuthMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () { setAuthBusy(false); });
      }

      function doLogout() {
        if (authBusy) return;
        setAuthBusy(true);
        setAuthMsg(null);
        callApi("auth/logout", {}).then(function (res) {
          setAuth("anon");
          setLogin(null);
          setQuota(null);
          setLoginOpen(false);
          setTokenInput("");
          setAuthMsg({ ok: true, text: "已注销" });
          if (res && res.error) setAuthMsg({ ok: false, text: res.error });
        }, function (err) {
          setAuthMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () { setAuthBusy(false); });
      }

      function saveProxy() {
        var v = proxyInput.trim();
        if (proxyBusy) return;
        setProxyBusy(true);
        setProxyMsg(null);
        callApi("config/set", { proxy: v || null }).then(function (res) {
          if (res && res.ok) {
            setProxy(v || null);
            setProxyOpen(false);
            setProxyInput("");
            setProxyMsg({ ok: true, text: v ? "代理已保存" : "已清除代理" });
          } else {
            setProxyMsg({ ok: false, text: (res && res.error) || "保存失败" });
          }
        }, function (err) {
          setProxyMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () { setProxyBusy(false); });
      }

      function openDetail(item) {
        setSelected(item);
        setDetail(null);
        setInstall(null);
        setDetailLoading(true);
        callApi("info", { fullName: item.fullName }).then(function (res) {
          setDetail(res);
        }, function (err) {
          setDetail({ ok: false, error: String((err && err.message) || err) });
        }).then(function () { setDetailLoading(false); });
      }

      function doInstall() {
        if (!selected) return;
        setInstall({ status: "running", installingBundle: false });
        callApi("install", { fullName: selected.fullName }).then(function (res) {
          if (res && res.ok) {
            var kind = res.install && res.install.kind;
            if (kind === "dynamic" && inputActions && typeof inputActions.setDraft === "function") {
              var cmd = "请安装插件 " + selected.fullName + "。源码已由插件市场获取并缓存，请直接调用 market_install（会立即返回 staged 源码），然后执行 cordis_define 定义 Package、cordis_run 激活（Client 半侧首次运行需批准），完成后告诉我结果。";
              try {
                inputActions.setDraft(cmd);
                setInstall({ status: "done", payload: res, drafted: true });
              } catch (e) {
                setInstall({ status: "done", payload: res });
              }
            } else if (kind === "bundle") {
              if (res.subPackages && res.subPackages.length > 1) {
                // 插件集合：先让用户选择子包
                setInstall({ status: "pick", payload: res, subPackages: res.subPackages });
              } else if (res.rootNpm && res.rootNpm.available) {
                // 单包但已发布 npm：让用户选 npm 或源码
                setInstall({ status: "pick", payload: res, rootNpmPick: true });
              } else {
                runBundleInstall(res.pkgPath || null);
              }
            } else if (kind === "list") {
              setInstall({ status: "done", payload: res, listOnly: true });
            } else {
              setInstall({ status: "done", payload: res });
            }
          } else {
            setInstall({ status: "error", error: (res && res.error) || "安装准备失败" });
          }
        }, function (err) {
          setInstall({ status: "error", error: String((err && err.message) || err) });
        });
      }

      // 安装成功后把当前详情/列表标记为已安装，避免界面仍停留在“未安装”状态
      function markDetailInstalled() {
        setDetail(function (d) { return d && d.ok ? Object.assign({}, d, { installed: true }) : d; });
        setSelected(function (s) { return s ? Object.assign({}, s, { installed: true }) : s; });
        setItems(function (prev) {
          if (!prev || !selected) return prev;
          return prev.map(function (it) { return it.fullName === selected.fullName ? Object.assign({}, it, { installed: true }) : it; });
        });
      }

      // 真·一键安装：Host 自动 clone 到 plugin-src + 写 profile + 建 junction
      function runBundleInstall(pkgPath) {
        setInstall({ status: "running", installingBundle: true });
        callApi("install/run", { fullName: selected.fullName, kind: "bundle", pkgPath: pkgPath || null }).then(function (r2) {
          if (r2 && r2.ok) {
            setInstall({ status: "done", payload: r2, bundleInstalled: true, bundleCmd: r2.addCmd || null });
            markDetailInstalled();
          } else {
            setInstall({ status: "error", error: (r2 && r2.error) || "安装失败" });
          }
        }, function (err2) {
          setInstall({ status: "error", error: String((err2 && err2.message) || err2) });
        });
      }

      // npm 安装（官方推荐路径）：Host 执行 pnpm add + bundles 注册
      function runNpmInstall(pkgName) {
        setInstall({ status: "running", installingBundle: true });
        callApi("install/run", { kind: "npm", pkgName: pkgName }).then(function (r2) {
          if (r2 && r2.ok) {
            setInstall({ status: "done", payload: r2, bundleInstalled: true });
            markDetailInstalled();
          } else {
            setInstall({ status: "error", error: (r2 && r2.error) || "npm 安装失败" });
          }
        }, function (err2) {
          setInstall({ status: "error", error: String((err2 && err2.message) || err2) });
        });
      }

      function fmtNum(n) {
        if (n == null) return "—";
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }

      function kindLabel(kind) {
        if (kind === "dynamic") return "动态插件";
        if (kind === "bundle") return "Bundle 插件";
        if (kind === "list") return "收录列表";
        return "";
      }

      function quotaText(q) {
        if (!q || typeof q.remaining !== "number") return null;
        var isSearch = q.resource === "search";
        var label = isSearch ? "搜索配额" : "API 配额";
        var unit = isSearch ? "· 分" : "· 时";
        var low = isSearch ? q.remaining < 3 : q.remaining < Math.max(50, (q.limit || 0) / 10);
        return React.createElement("span", { key: "quota", className: low ? "dshm-note" : "dshm-desc" }, label + " " + fmtNum(q.remaining) + "/" + fmtNum(q.limit) + " " + unit);
      }

      function visibleItems() {
        var out = (items || []).slice();
        if (filterSource) {
          out = out.filter(function (i) { return i.source === filterSource; });
        }
        if (filterLang) {
          out = out.filter(function (i) { return (i.language || "") === filterLang; });
        }
        var key = sortBy;
        out.sort(function (a, b) {
          if (key === "forks") return (b.forks || 0) - (a.forks || 0);
          if (key === "updated") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
          if (key === "name") return String(a.fullName).localeCompare(String(b.fullName));
          return (b.stars || 0) - (a.stars || 0);
        });
        return out;
      }

      function langOptions() {
        var set = {};
        for (var i = 0; i < (items || []).length; i += 1) {
          var l = items[i].language;
          if (l) set[l] = true;
        }
        return Object.keys(set).sort();
      }

      function renderFilters() {
        var langs = langOptions();
        var langsOpts = [React.createElement("option", { key: "", value: "" }, "全部语言")].concat(langs.map(function (l) { return React.createElement("option", { key: l, value: l }, l); }));
        return React.createElement("div", { className: "dshm-filters" },
          React.createElement("select", {
            className: "dshm-select",
            value: filterSource,
            onChange: function (e) { setFilterSource(e.target.value); },
          },
            React.createElement("option", { key: "", value: "" }, "全部来源"),
            React.createElement("option", { key: "github", value: "github" }, "GitHub 搜索"),
            React.createElement("option", { key: "curated", value: "curated" }, "收录列表")
          ),
          React.createElement("select", {
            className: "dshm-select",
            value: filterLang,
            onChange: function (e) { setFilterLang(e.target.value); },
          }, langsOpts),
          React.createElement("select", {
            className: "dshm-select",
            value: sortBy,
            onChange: function (e) { setSortBy(e.target.value); },
          },
            React.createElement("option", { key: "stars", value: "stars" }, "按 Stars 排序"),
            React.createElement("option", { key: "forks", value: "forks" }, "按 Forks 排序"),
            React.createElement("option", { key: "updated", value: "updated" }, "按最近更新"),
            React.createElement("option", { key: "name", value: "name" }, "按名称排序")
          )
        );
      }

      // ── 插件管理：已安装第三方插件 ────────────────────────────
      function loadManage() {
        setManageBusy(true);
        setManageMsg(null);
        callApi("manage/list", {}).then(function (res) {
          setManaged((res && res.plugins) || []);
          if (res && res.error) setManageMsg({ ok: false, text: res.error });
        }, function (err) {
          setManaged([]);
          setManageMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () { setManageBusy(false); });
      }

      function fmtTime(ms) {
        if (!ms) return "—";
        try {
          var d = new Date(ms);
          var p = function (n) { return String(n).padStart(2, "0"); };
          return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
        } catch (e) { return "—"; }
      }

      function checkOne(name) {
        setManageBusy(true);
        setManageMsg(null);
        var next = Object.assign({}, checkNames);
        next[name] = true;
        setCheckNames(next);
        callApi("manage/check-updates", { names: [name] }).then(function (res) {
          if (res && res.plugins && res.plugins.length) {
            setManaged((managed || []).map(function (p) { return p.name === name ? Object.assign({}, p, res.plugins[0]) : p; }));
          }
          if (res && res.error) setManageMsg({ ok: false, text: res.error });
        }, function (err) {
          setManageMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () {
          setManageBusy(false);
          var n2 = Object.assign({}, checkNames);
          delete n2[name];
          setCheckNames(n2);
        });
      }

      function checkAll() {
        setManageBusy(true);
        setManageMsg(null);
        callApi("manage/check-updates", {}).then(function (res) {
          if (res && res.plugins) {
            var byName = {};
            res.plugins.forEach(function (p) { byName[p.name] = p; });
            setManaged((managed || []).map(function (p) { return byName[p.name] ? Object.assign({}, p, byName[p.name]) : p; }));
          }
          if (res && res.error) setManageMsg({ ok: false, text: res.error });
        }, function (err) {
          setManageMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () { setManageBusy(false); });
      }

      function doUpdate(name) {
        if (updatingName) return;
        setUpdatingName(name);
        setManageMsg(null);
        callApi("manage/update", { name: name }).then(function (res) {
          if (res && res.ok) {
            setManaged((managed || []).map(function (p) { return p.name === name ? Object.assign({}, p, { hasUpdate: false, checkState: 'ok' }) : p; }));
            setManageSelected(function (s) { return s && s.name === name ? Object.assign({}, s, { hasUpdate: false, checkState: 'ok' }) : s; });
            setManageMsg({ ok: true, text: (res && res.note) || ("已更新 " + name + "，重启 DSH 后生效") });
          } else {
            setManageMsg({ ok: false, text: (res && res.error) || "更新失败" });
          }
        }, function (err) {
          setManageMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () { setUpdatingName(null); });
      }

      function doUninstall(name) {
        if (uninstallArm !== name) {
          setUninstallArm(name);
          return;
        }
        setUninstallArm(null);
        setManageBusy(true);
        setManageMsg(null);
        callApi("manage/uninstall", { name: name }).then(function (res) {
          if (res && res.ok) {
            setManaged((managed || []).filter(function (p) { return p.name !== name; }));
            setManageMsg({ ok: true, text: (res && res.note) || ("已卸载 " + name + "，重启 DSH 后生效") });
          } else {
            setManageMsg({ ok: false, text: (res && res.error) || "卸载失败" });
          }
        }, function (err) {
          setManageMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () { setManageBusy(false); });
      }

      function doRemoveSrc(name) {
        if (removeArm !== name) {
          setRemoveArm(name);
          return;
        }
        setRemoveArm(null);
        setManageBusy(true);
        setManageMsg(null);
        callApi("manage/remove-src", { name: name }).then(function (res) {
          if (res && res.ok) {
            setManaged((managed || []).filter(function (p) { return p.name !== name; }));
            setManageMsg({ ok: true, text: (res && res.note) || ("已删除 " + name) });
          } else {
            setManageMsg({ ok: false, text: (res && res.error) || "删除失败" });
          }
        }, function (err) {
          setManageMsg({ ok: false, text: String((err && err.message) || err) });
        }).then(function () { setManageBusy(false); });
      }

      function kindLabelM(kind) {
        if (kind === "skin") return "皮肤";
        if (kind === "src") return "源码目录";
        return "Bundle";
      }

      // 显示名：优先仓库全名，其次 plugin-src 目录名，最后包名（包名始终作为辅助信息展示）
      function manageDisplayName(p) {
        return (p && (p.repoFullName || p.repoDir)) || (p && p.name) || "";
      }

      // 打开插件管理详情：有仓库则拉取 GitHub 详情（README/清单），无仓库只显示本地信息
      function openManageDetail(p) {
        setManageSelected(p);
        setManageDetail(null);
        setManageDetailLoading(true);
        if (p && p.repoFullName) {
          callApi("info", { fullName: p.repoFullName }).then(function (res) {
            setManageDetail(res);
          }, function (err) {
            setManageDetail({ ok: false, error: String((err && err.message) || err) });
          }).then(function () { setManageDetailLoading(false); });
        } else {
          setManageDetailLoading(false);
        }
      }

      function renderManageDetail() {
        var p = manageSelected;
        var rows = [];
        rows.push(React.createElement("button", { key: "back", className: "dshm-btn dshm-back", onClick: function () { setManageSelected(null); setManageDetail(null); } }, "← 返回插件管理"));
        rows.push(React.createElement("div", { key: "head", className: "dshm-card-head" },
          React.createElement("span", { className: "dshm-name" }, manageDisplayName(p)),
          React.createElement("span", { key: "k", className: "dshm-badge dshm-badge-kind" }, kindLabelM(p.kind)),
          p.suiteLabel ? React.createElement("span", { key: "suite", className: "dshm-badge" }, "套装") : null,
          p.version ? React.createElement("span", { className: "dshm-desc" }, "v" + p.version) : null,
          p.referenced === false ? React.createElement("span", { key: "f", className: "dshm-badge" }, "源码残留（未安装）") : null
        ));
        if (p.description) rows.push(React.createElement("div", { key: "desc", className: "dshm-desc" }, p.description));
        rows.push(React.createElement("div", { key: "meta", className: "dshm-grid" },
          React.createElement("span", null, "包名: " + p.name),
          React.createElement("span", null, "类型: " + kindLabelM(p.kind)),
          p.suiteLabel ? React.createElement("span", null, "套装: " + p.suiteLabel) : null,
          React.createElement("span", null, "版本: " + (p.version || "—")),
          React.createElement("span", null, "本地更新: " + fmtTime(p.localUpdatedAt)),
          React.createElement("span", null, "profile: " + (p.profile || "无引用")),
          p.repoFullName ? React.createElement("a", { key: "repo", href: "https://github.com/" + p.repoFullName, target: "_blank", rel: "noreferrer" }, p.repoFullName + " ↗") : React.createElement("span", null, "无仓库信息")
        ));
        if (p.path) rows.push(React.createElement("div", { key: "path", className: "dshm-pre" }, p.path));
        if (p.suiteComponents && p.suiteComponents.length) {
          rows.push(React.createElement("div", { key: "suitehead", className: "dshm-name" }, "关联组件/预设（卸载时会一并删除）"));
          rows.push(React.createElement("div", { key: "suitecomps", className: "dshm-status" },
            p.suiteComponents.map(function (s, i) { return React.createElement("div", { key: i, className: "dshm-desc" }, "• " + s); })
          ));
          if (p.extraCleanupDirs && p.extraCleanupDirs.length) {
            rows.push(React.createElement("div", { key: "suitedirs", className: "dshm-pre" }, p.extraCleanupDirs.join("\n")));
          }
        }
        if (manageDetailLoading) {
          rows.push(React.createElement("div", { key: "loading", className: "dshm-desc" }, "加载仓库详情…"));
        } else if (manageDetail && manageDetail.ok === false) {
          rows.push(React.createElement("div", { key: "derr", className: "dshm-status" }, React.createElement("div", { className: "dshm-error" }, "仓库详情加载失败：" + (manageDetail.error || "未知错误"))));
        } else if (manageDetail && manageDetail.info) {
          var info = manageDetail.info;
          rows.push(React.createElement("div", { key: "rmeta", className: "dshm-grid" },
            React.createElement("span", null, "Stars: " + fmtNum(info.stars)),
            React.createElement("span", null, "Forks: " + fmtNum(info.forks)),
            React.createElement("span", null, "Language: " + (info.language || "—")),
            React.createElement("span", null, "License: " + (info.license || "—")),
            React.createElement("span", null, "默认分支: " + info.defaultBranch),
            React.createElement("span", null, "归档: " + (info.archived ? "是" : "否"))
          ));
          if (info.topics && info.topics.length) {
            rows.push(React.createElement("div", { key: "topics", className: "dshm-meta" }, info.topics.slice(0, 10).map(function (t) { return React.createElement("span", { key: t, className: "dshm-badge" }, t); })));
          }
          if (manageDetail.readme) {
            rows.push(React.createElement("div", { key: "rmhead", className: "dshm-name" }, "README"),
              React.createElement("div", { key: "rm", className: "dshm-status" }, renderMarkdown(manageDetail.readme, { fullName: info.fullName, branch: info.defaultBranch, readmePath: manageDetail.readmePath || 'README.md' })));
          }
          if (manageDetail.files && manageDetail.files.length) {
            rows.push(React.createElement("div", { key: "flhead", className: "dshm-name" }, "清单文件"),
              React.createElement("div", { key: "fl", className: "dshm-detail" }, manageDetail.files.map(function (f) {
                return React.createElement("div", { key: f.path, className: "dshm-file" },
                  React.createElement("span", null, f.path),
                  React.createElement("span", null, f.size == null ? "" : fmtNum(f.size) + " B"));
              })));
          }
        } else {
          rows.push(React.createElement("div", { key: "norepo", className: "dshm-note" }, "该插件没有可用的 GitHub 仓库信息，仅显示本地状态。"));
        }
        rows.push(React.createElement("div", { key: "actions", className: "dshm-manage-actions" },
          React.createElement("button", { className: "dshm-btn", disabled: manageBusy, onClick: function () { checkOne(p.name); } }, "检查更新"),
          (p.referenced === false || p.hasUpdate !== true) ? null : React.createElement("button", { className: "dshm-btn dshm-btn-primary", disabled: manageBusy || updatingName === p.name, onClick: function () { doUpdate(p.name); } }, updatingName === p.name ? "更新中…" : "更新"),
          p.referenced === false
            ? React.createElement("button", { className: "dshm-btn dshm-btn-danger" + (removeArm === p.name ? " dshm-btn-primary" : ""), disabled: manageBusy, onClick: function () { doRemoveSrc(p.name); } }, removeArm === p.name ? "确认删除源码？" : "删除源码")
            : React.createElement("button", { className: "dshm-btn dshm-btn-danger" + (uninstallArm === p.name ? " dshm-btn-primary" : ""), disabled: manageBusy, onClick: function () { doUninstall(p.name); } }, uninstallArm === p.name ? (p.suiteLabel ? "确认卸载？（含源码/预设，共 " + (p.suiteComponents ? p.suiteComponents.length : 0) + " 个组件）" : "确认卸载？（含源码）") : "卸载")
        ));
        if (manageMsg) {
          rows.push(React.createElement("div", { key: "msg", className: "dshm-status" },
            React.createElement("div", { className: manageMsg.ok ? "dshm-ok" : "dshm-error" }, manageMsg.text)));
        }
        return React.createElement("div", { className: "dshm-detail" }, rows);
      }

      function renderManage() {
        if (manageSelected) return renderManageDetail();
        if (managed === null) {
          return React.createElement("div", { className: "dshm-desc" }, "加载已安装插件…");
        }
        var rows = [];
        // forEach：回调参数独立绑定，避免 var 循环闭包（点击总是最后一个）
        managed.forEach(function (p) {
          var statusNode = null;
          if (p.checkState === "ok") {
            statusNode = React.createElement("span", { key: "st", className: p.hasUpdate ? "dshm-up-new" : "dshm-up-fresh" },
              p.hasUpdate ? ("有新版本" + (p.remoteVersion ? "（远程 " + p.remoteVersion + " vs 本地 " + (p.version || "?") + "）" : "")) : "已是最新" + (p.remoteVersion && p.remoteVersion !== p.version ? "（远程 " + p.remoteVersion + " vs 本地 " + (p.version || "?") + "）" : ""));
          } else if (p.checkState === "no-repo") {
            statusNode = React.createElement("span", { key: "st", className: "dshm-desc" }, "无仓库信息，无法检查更新");
          } else if (p.checkState === "error") {
            statusNode = React.createElement("span", { key: "st", className: "dshm-up-err" }, "检查失败：" + (p.checkError || "未知错误"));
          }
          var badges = [React.createElement("span", { key: "k", className: "dshm-badge dshm-badge-kind" }, kindLabelM(p.kind))];
          if (p.suiteLabel) badges.push(React.createElement("span", { key: "suite", className: "dshm-badge" }, "套装"));
          if (p.referenced === false) badges.push(React.createElement("span", { key: "f", className: "dshm-badge" }, "源码残留（未安装）"));
          rows.push(React.createElement("div", { key: p.name, className: "dshm-manage-row dshm-card", onClick: function () { openManageDetail(p); } },
            React.createElement("div", { className: "dshm-card-head" },
              React.createElement("span", { className: "dshm-name" }, manageDisplayName(p)),
              badges,
              p.version ? React.createElement("span", { className: "dshm-desc" }, "v" + p.version) : null,
              statusNode
            ),
            React.createElement("div", { className: "dshm-meta" },
              React.createElement("span", null, "包名 " + p.name),
              React.createElement("span", null, "本地更新 " + fmtTime(p.localUpdatedAt)),
              p.profile ? React.createElement("span", null, "profile: " + p.profile) : React.createElement("span", null, "未被任何 profile 引用")
            ),
            p.description ? React.createElement("div", { className: "dshm-desc" }, p.description) : null,
            p.suiteComponents && p.suiteComponents.length ? React.createElement("div", { className: "dshm-desc" }, "关联组件/预设: " + p.suiteComponents.join("、")) : null,
            React.createElement("div", { className: "dshm-manage-actions" },
              React.createElement("button", { className: "dshm-btn", disabled: manageBusy || !!checkNames[p.name], onClick: function (e) { if (e) e.stopPropagation(); checkOne(p.name); } }, checkNames[p.name] ? "检查中…" : "检查更新"),
              (p.referenced === false || p.hasUpdate !== true) ? null : React.createElement("button", { className: "dshm-btn dshm-btn-primary", disabled: manageBusy || updatingName === p.name, onClick: function (e) { if (e) e.stopPropagation(); doUpdate(p.name); } }, updatingName === p.name ? "更新中…" : "更新"),
              p.referenced === false
                ? React.createElement("button", { className: "dshm-btn dshm-btn-danger" + (removeArm === p.name ? " dshm-btn-primary" : ""), disabled: manageBusy, onClick: function (e) { if (e) e.stopPropagation(); doRemoveSrc(p.name); } }, removeArm === p.name ? "确认删除源码？" : "删除源码")
                : React.createElement("button", { className: "dshm-btn dshm-btn-danger" + (uninstallArm === p.name ? " dshm-btn-primary" : ""), disabled: manageBusy, onClick: function (e) { if (e) e.stopPropagation(); doUninstall(p.name); } }, uninstallArm === p.name ? (p.suiteLabel ? "确认卸载？（含源码/预设，共 " + (p.suiteComponents ? p.suiteComponents.length : 0) + " 个组件）" : "确认卸载？（含源码）") : "卸载")
            )
          ));
        });
        if (rows.length === 0) {
          rows.push(React.createElement("div", { key: "empty", className: "dshm-desc" }, "没有检测到已安装的第三方插件。"));
        }
        return React.createElement("div", { className: "dshm-list" },
          React.createElement("div", { className: "dshm-manage-head" },
            React.createElement("span", { className: "dshm-name" }, "已安装的第三方插件"),
            React.createElement("button", { className: "dshm-btn", disabled: manageBusy || !managed.length, onClick: checkAll }, manageBusy ? "检查中…" : "全部检查更新")
          ),
          manageMsg ? React.createElement("div", { key: "msg", className: "dshm-status" },
            React.createElement("div", { className: manageMsg.ok ? "dshm-ok" : "dshm-error" }, manageMsg.text)) : null,
          rows
        );
      }

      function renderAuth() {
        var rows = [];
        if (auth === "token") {
          rows.push(React.createElement("span", { key: "st", className: "dshm-ok" }, "已登录 GitHub：@" + (login || "unknown")));
          rows.push(React.createElement("button", { key: "out", className: "dshm-btn", disabled: authBusy, onClick: doLogout }, "注销"));
        } else {
          rows.push(React.createElement("button", { key: "in", className: "dshm-btn", disabled: authBusy, onClick: function () { setLoginOpen(!loginOpen); setAuthMsg(null); } }, loginOpen ? "取消" : "GitHub 登录"));
          rows.push(React.createElement("span", { key: "st", className: "dshm-desc" }, "未登录（限流 60 次/小时），登录后 5,000 次/小时"));
        }
        if (loginOpen && auth !== "token") {
          rows.push(React.createElement("div", { key: "form", className: "dshm-login" },
            React.createElement("input", {
              className: "dshm-token",
              type: "password",
              placeholder: "粘贴 GitHub Personal Access Token (ghp_… / github_pat_…)",
              value: tokenInput,
              onChange: function (e) { setTokenInput(e.target.value); },
              onKeyDown: function (e) { if (e.key === "Enter") doLogin(); },
            }),
            React.createElement("button", { className: "dshm-btn dshm-btn-primary", disabled: authBusy || !tokenInput.trim(), onClick: doLogin }, authBusy ? "验证中…" : "登录")
          ));
        }
        if (quota && typeof quota.remaining === "number") {
          rows.push(quotaText(quota));
        }
        if (proxy) {
          rows.push(React.createElement("span", { key: "px", className: "dshm-desc" }, "代理 " + proxy));
        }
        rows.push(React.createElement("button", { key: "pxb", className: "dshm-btn", disabled: proxyBusy, onClick: function () { setProxyOpen(!proxyOpen); setProxyMsg(null); } }, proxyOpen ? "取消" : (proxy ? "改代理" : "代理")));
        if (proxyOpen) {
          rows.push(React.createElement("div", { key: "pxform", className: "dshm-login" },
            React.createElement("input", {
              className: "dshm-proxy",
              placeholder: "http://127.0.0.1:7890（留空清除）",
              value: proxyInput,
              onChange: function (e) { setProxyInput(e.target.value); },
              onKeyDown: function (e) { if (e.key === "Enter") saveProxy(); },
            }),
            React.createElement("button", { className: "dshm-btn dshm-btn-primary", disabled: proxyBusy, onClick: saveProxy }, proxyBusy ? "保存中…" : "保存")
          ));
        }
        if (authMsg) {
          rows.push(React.createElement("div", { key: "amsg", className: authMsg.ok ? "dshm-ok" : "dshm-error" }, authMsg.text));
        }
        if (proxyMsg) {
          rows.push(React.createElement("div", { key: "pmsg", className: proxyMsg.ok ? "dshm-ok" : "dshm-error" }, proxyMsg.text));
        }
        return React.createElement("div", { className: "dshm-auth" }, rows);
      }

      function renderList() {
        var visible = visibleItems();
        var rows = [];
        // 用 forEach 而非 for+var：回调参数每次调用独立绑定，避免所有卡片
        // onClick 共享同一个循环变量（点击任何项目都打开最后一项的闭包陷阱）。
        visible.forEach(function (it) {
          var badges = [React.createElement("span", { key: "src", className: "dshm-badge" + (it.source === "github" ? " dshm-badge-live" : "") }, it.source === "github" ? "GitHub" : (it.category || "收录"))];
          if (it.installKind) badges.push(React.createElement("span", { key: "kind", className: "dshm-badge dshm-badge-kind" }, kindLabel(it.installKind)));
          if (it.installed) badges.push(React.createElement("span", { key: "inst", className: "dshm-badge dshm-badge-installed" }, "已安装"));
          rows.push(React.createElement("div", {
            key: it.fullName,
            className: "dshm-card",
            onClick: function () { openDetail(it); },
          },
            React.createElement("div", { className: "dshm-card-head" },
              React.createElement("span", { className: "dshm-name" }, it.fullName),
              badges
            ),
            it.description ? React.createElement("div", { className: "dshm-desc" }, it.description) : null,
            React.createElement("div", { className: "dshm-meta" },
              React.createElement("span", null, "★ " + fmtNum(it.stars)),
              it.language ? React.createElement("span", null, it.language) : null,
              React.createElement("span", null, it.source === "github" ? "GitHub 搜索" : "收录列表")
            )
          ));
        });
        if (rows.length === 0) {
          rows.push(React.createElement("div", { key: "empty", className: "dshm-desc" }, "没有找到匹配的插件，换个关键词或调整筛选试试。"));
        }
        var children = rows.slice();
        if (hasMore && !filterSource && !filterLang) {
          children.push(React.createElement("button", { key: "more", className: "dshm-btn dshm-more", disabled: loadingMore, onClick: loadMore }, loadingMore ? "加载中…" : "加载更多"));
        }
        return React.createElement("div", { className: "dshm-list" }, children);
      }

      function renderDetail() {
        if (detailLoading) return React.createElement("div", { className: "dshm-desc" }, "加载详情中…");
        if (!detail) return null;
        if (!detail.ok) {
          return React.createElement("div", { className: "dshm-status" },
            React.createElement("div", { className: "dshm-error" }, "详情加载失败：" + (detail.error || "未知错误")));
        }
        var info = detail.info;
        var rows = [];
        rows.push(React.createElement("button", { key: "back", className: "dshm-btn dshm-back", onClick: function () { setSelected(null); setDetail(null); } }, "← 返回列表"));
        rows.push(React.createElement("div", { key: "head", className: "dshm-card-head" },
          React.createElement("span", { className: "dshm-name" }, info.fullName),
          info.archived ? React.createElement("span", { className: "dshm-badge" }, "已归档") : null,
          detail.installed ? React.createElement("span", { className: "dshm-badge dshm-badge-installed" }, "已安装") : null,
          detail.install && detail.install.kind ? React.createElement("span", { className: "dshm-badge dshm-badge-kind" }, kindLabel(detail.install.kind)) : null
        ));
        if (info.description) rows.push(React.createElement("div", { key: "desc", className: "dshm-desc" }, info.description));
        rows.push(React.createElement("div", { key: "meta", className: "dshm-grid" },
          React.createElement("span", null, "Stars: " + fmtNum(info.stars)),
          React.createElement("span", null, "Forks: " + fmtNum(info.forks)),
          React.createElement("span", null, "Language: " + (info.language || "—")),
          React.createElement("span", null, "License: " + (info.license || "—")),
          React.createElement("span", null, "Issues: " + fmtNum(info.openIssues)),
          React.createElement("span", null, "默认分支: " + info.defaultBranch),
          info.homepage ? React.createElement("a", { key: "home", href: info.homepage, target: "_blank", rel: "noreferrer" }, "主页 ↗") : null
        ));
        if (info.topics && info.topics.length) {
          rows.push(React.createElement("div", { key: "topics", className: "dshm-meta" }, info.topics.slice(0, 10).map(function (t) { return React.createElement("span", { key: t, className: "dshm-badge" }, t); })));
        }
        rows.push(React.createElement("button", { key: "install", className: "dshm-btn dshm-btn-primary", disabled: !!(install && (install.status === "running" || install.status === "pick")), onClick: doInstall },
          install && install.status === "running" ? (install.installingBundle ? "正在安装（克隆源码）…" : "获取源码中…") : (detail.installed ? "已安装（重新获取源码）" : "一键安装")));
        if (install && install.status === "error") {
          rows.push(React.createElement("div", { key: "ierr", className: "dshm-status" }, React.createElement("div", { className: "dshm-error" }, "失败：" + install.error)));
        }
        if (install && install.status === "pick") {
          var pl = install.payload || {};
          var subs = (install.subPackages || []).filter(function (sp) { return sp.installable || (sp.npm && sp.npm.available); });
          if (!subs.length && pl.rootNpm && pl.rootNpm.available) {
            // 单包场景：npm 已发布 → 二选一
            rows.push(React.createElement("div", { key: "pick", className: "dshm-status" },
              React.createElement("div", { className: "dshm-ok" }, "该插件已发布到 npm（" + (pl.rootNpm.version ? "v" + pl.rootNpm.version : "最新版") + "），推荐 npm 安装（官方路径，自动处理依赖与构建）："),
              React.createElement("div", { className: "dshm-manage-actions" },
                React.createElement("button", { className: "dshm-btn dshm-btn-primary", onClick: function () { runNpmInstall(pl.rootNpm.name || selected.fullName); } }, "npm 安装"),
                React.createElement("button", { className: "dshm-btn", onClick: function () { runBundleInstall(pl.pkgPath || null); } }, "源码安装（备选）")
              )
            ));
          } else if (subs.length) {
            var groups = [
              { key: "recommended", label: "官方推荐聚合包", items: [] },
              { key: "skin", label: "皮肤", items: [] },
              { key: "plugin", label: "插件", items: [] },
              { key: "other", label: "其他", items: [] },
            ];
            subs.forEach(function (sp) {
              var g = groups.find(function (x) { return x.key === (sp.kind || "other"); }) || groups[3];
              g.items.push(sp);
            });
            var inner = [React.createElement("div", { key: "t", className: "dshm-name" }, "该仓库是插件集合（" + subs.length + " 个可选，已按类分组）：")];
            groups.forEach(function (g) {
              if (!g.items.length) return;
              inner.push(React.createElement("div", { key: g.key + "-h", className: "dshm-desc" }, "▸ " + g.label + "（" + g.items.length + "）"));
              g.items.forEach(function (sp) {
                inner.push(React.createElement("div", { key: g.key + sp.dir, className: "dshm-manage-row" },
                  React.createElement("span", { className: "dshm-name" }, sp.name || sp.dir),
                  React.createElement("div", { className: "dshm-manage-actions" },
                    sp.npm && sp.npm.available
                      ? React.createElement("button", { className: "dshm-btn dshm-btn-primary", title: "npm 安装（官方推荐，自动处理依赖与构建）", onClick: function () { runNpmInstall(sp.name); } }, "npm 安装" + (sp.npm.version ? " v" + sp.npm.version : ""))
                      : null,
                    sp.installable
                      ? React.createElement("button", { className: "dshm-btn", title: "从 GitHub 源码安装", onClick: function () { runBundleInstall(sp.pkgPath); } }, "源码安装")
                      : null
                  )
                ));
              });
            });
            rows.push(React.createElement("div", { key: "pick", className: "dshm-status" }, inner));
          } else {
            rows.push(React.createElement("div", { key: "pick", className: "dshm-status" },
              React.createElement("div", { className: "dshm-note" }, "该仓库没有可安装的子包（子包多为需在仓库内构建的聚合包）。")));
          }
        }
        if (install && install.status === "done") {
          var p = install.payload;
          var inner = [];
          // 注意：drafted/bundleInstalled/listOnly 由 doInstall 放在 install 对象顶层，
          // 不在 payload 里——必须读 install.xxx（此前读 p.xxx 恒为 undefined，
          // 导致任何形态都落入 else 分支的错误引导）。
          if (install.bundleInstalled) {
            inner.push(React.createElement("div", { key: "i1", className: "dshm-ok" }, "✓ 安装完成：" + (p.pkgName || selected.fullName)));
            if (p.path) inner.push(React.createElement("div", { key: "i2", className: "dshm-desc" }, "源码：" + p.path));
            inner.push(React.createElement("div", { key: "i3", className: "dshm-desc" }, (p.note || "重启 DSH 后生效。")));
          } else if (install.drafted) {
            inner.push(React.createElement("div", { key: "d1", className: "dshm-ok" }, "✓ 源码已获取，安装指令已填入下方输入框"));
            inner.push(React.createElement("div", { key: "d2", className: "dshm-desc" }, "按 Enter 发送，助手会自动完成 define + run（首次运行需批准）。"));
          } else if (install.bundleCmd) {
            inner.push(React.createElement("div", { key: "b1", className: "dshm-ok" }, "✓ 源码已获取 · Bundle 插件（npm 方式安装）"));
            inner.push(React.createElement("div", { key: "b2", className: "dshm-desc" }, "在 DSH 终端执行："), React.createElement("pre", { key: "b3", className: "dshm-pre" }, install.bundleCmd));
            inner.push(React.createElement("button", { key: "b4", className: "dshm-btn", onClick: function () { copyCmd(install.bundleCmd); } }, copiedCmd === install.bundleCmd ? "已复制 ✓" : "复制命令"));
            inner.push(React.createElement("div", { key: "b5", className: "dshm-note" }, "提示：该命令使用 github: 形式，无本地路径空格问题。"));
          } else if (install.listOnly) {
            inner.push(React.createElement("div", { key: "l1", className: "dshm-note" }, "该仓库为收录/资料类，不可直接安装。"));
          } else {
            inner.push(React.createElement("div", { key: "o1", className: "dshm-ok" }, "✓ 源码已获取" + (p.staged ? "（缓存）" : "") + "，共 " + p.files.length + " 个清单文件"));
            inner.push(React.createElement("div", { key: "o2", className: "dshm-desc" }, "在对话中告诉助手：安装 " + selected.fullName));
          }
          rows.push(React.createElement("div", { key: "idone", className: "dshm-status" }, inner));
        }
        if (detail.readme) {
          rows.push(React.createElement("div", { key: "rmhead", className: "dshm-name" }, "README"),
            React.createElement("div", { key: "rm", className: "dshm-status" }, renderMarkdown(detail.readme, { fullName: info.fullName, branch: info.defaultBranch, readmePath: detail.readmePath || 'README.md' })));
        }
        if (detail.files && detail.files.length) {
          rows.push(React.createElement("div", { key: "flhead", className: "dshm-name" }, "清单文件"),
            React.createElement("div", { key: "fl", className: "dshm-detail" }, detail.files.map(function (f) {
              return React.createElement("div", { key: f.path, className: "dshm-file" },
                React.createElement("span", null, f.path),
                React.createElement("span", null, f.size == null ? "" : fmtNum(f.size) + " B"));
            })));
        }
        rows.push(React.createElement("a", { key: "gh", href: info.htmlUrl, target: "_blank", rel: "noreferrer" }, "在 GitHub 上查看 ↗"));
        return React.createElement("div", { className: "dshm-detail" }, rows);
      }

      return React.createElement("div", { className: "dshm" },
        React.createElement("div", { className: "dshm-tabs" },
          React.createElement("button", { className: "dshm-tab" + (view === "market" ? " dshm-tab-active" : ""), onClick: function () { setView("market"); } }, "插件市场"),
          React.createElement("button", { className: "dshm-tab" + (view === "manage" ? " dshm-tab-active" : ""), onClick: function () { setView("manage"); if (managed === null) loadManage(); } }, "插件管理")
        ),
        view === "manage" ? renderManage() : React.createElement("div", { className: "dshm" },
          React.createElement("div", { className: "dshm-search" },
            React.createElement("input", {
              className: "dshm-input",
              placeholder: "搜索 DSH 插件（关键词 / 仓库名）…",
              value: query,
              onChange: function (e) { setQuery(e.target.value); },
              onKeyDown: function (e) { if (e.key === "Enter") runSearch(query); },
            }),
            React.createElement("button", { className: "dshm-btn dshm-btn-primary", disabled: loading, onClick: function () { runSearch(query); } }, loading ? "搜索中…" : "搜索"),
            React.createElement("button", { className: "dshm-btn", disabled: loading || refreshing, title: "强制重新拉取 GitHub 最新数据（绕过缓存）", onClick: function () { runSearch(query, true); } }, refreshing ? "刷新中…" : "刷新")
          ),
          renderAuth(),
          error ? React.createElement("div", { className: "dshm-error" }, error) : null,
          note ? React.createElement("div", { className: "dshm-note" }, note) : null,
          (selected || items === null) ? null : renderFilters(),
          selected ? renderDetail() : (items === null ? React.createElement("div", { className: "dshm-desc" }, "加载中…") : renderList()),
          React.createElement("div", { className: "dshm-desc" },
            "数据源：收录列表 + GitHub 仓库搜索（限定 DSH 相关）。安装：动态插件一键填入指令；Bundle 插件用 dsh plugin add。")
        )
      );
    }

    function apply(ctx) {
      var slots = ctx.get("slots");
      if (slots === undefined) return;
      slots.inject("conversation.view", function () {
        return slots.register(
          { name: "conversation.view", id: "dsh-market", order: 12, label: function () { return "插件市场"; } },
          function (props) { return React.createElement(MarketPage, { inputActions: props.inputActions }); }
        );
      });
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    return module.exports;
    //#endregion
  },
});

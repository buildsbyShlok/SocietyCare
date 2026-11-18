// Component rendering checks only. Fixtures replace network hooks; this is not browser QA.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { build } = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { MemoryRouter, Routes, Route } = require("react-router-dom");

async function main() {
  const root = path.resolve(__dirname, "..");
  const result = await build({
    stdin: {
      contents: [
        'export {default as Home} from "./src/pages/Home";',
        'export {default as Courtyard} from "./src/components/Courtyard";',
        'export {default as Dashboard} from "./src/pages/Dashboard";',
        'export {default as Notices} from "./src/components/HomeAnnouncements";',
        'export {default as NoticeDetail} from "./src/pages/NoticeDetail";',
        'export {default as Events,EventDetail} from "./src/pages/Events";',
        'export {default as Assets,AssetDetail,AssetEditor} from "./src/pages/Assets";',
        'export {QRComplaintForm} from "./src/pages/QRReport";',
        'export {default as Community} from "./src/pages/Community";',
        'export {default as Archive} from "./src/components/ArchiveComplaint";',
        'export {ResidentRecord} from "./src/components/ResidentRecord";',
        'export {default as Navbar} from "./src/components/Navbar";',
        'export {default as Dialog} from "./src/components/Dialog";',
        'export {default as Complaints} from "./src/pages/Complaints";',
        'export {default as UserManagement} from "./src/pages/UserManagement";',
        'export {default as ComplaintCard} from "./src/components/ComplaintCard";',
        'export {default as ComplaintSource} from "./src/components/ComplaintSource";',
        'export {default as AssetHistory} from "./src/components/AssetComplaintHistory";',
      ].join("\n"),
      resolveDir: root,
      loader: "jsx",
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    packages: "external",
    jsx: "automatic",
    loader: { ".css": "empty" },
    define: { "import.meta.env": "{}" },
    plugins: [
      {
        name: "isolated-network-fixtures",
        setup(b) {
          b.onLoad({ filter: /UserManagement\.jsx$/ }, ({path:p})=>({
            loader:"jsx",
            contents:fs.readFileSync(p,"utf8")
              .replace("[users, setUsers] = useState([])", "[users, setUsers] = useState(globalThis.ui.accounts || [])")
              .replace("[loading, setLoading] = useState(true)", "[loading, setLoading] = useState(false)")
          }));

          b.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({
            loader: "jsx",
            contents:
              "export const useAuth=()=>({user:globalThis.ui.user,token:'test-only'});",
          }));
          b.onLoad({ filter: /Workspace\.jsx$/ }, ({ path: p }) => ({
            loader: "jsx",
            contents: fs
              .readFileSync(p, "utf8")
              .replace(
                /export function useResource[\s\S]*?(?=export function Load)/,
                "export function useResource(path) {return {data:globalThis.ui.data[path], error:globalThis.ui.errors?.[path], retry:()=>{}};}\n",
              ),
          }));
          b.onLoad({ filter: /HomeAnnouncements\.jsx$/ }, ({ path: p }) => ({
            loader: "jsx",
            contents: fs
              .readFileSync(p, "utf8")
              .replace("useState({})", "useState(globalThis.ui.notices || {})"),
          }));
          b.onLoad({ filter: /Community\.jsx$/ }, ({ path: p }) => ({
            loader: "jsx",
            contents: fs
              .readFileSync(p, "utf8")
              .replace(
                "[feed, setFeed] = useState(null)",
                "[feed, setFeed] = useState(globalThis.ui.feed || null)",
              ),
          }));
        },
      },
    ],
  });
  const filename = path.join(root, "tests", "virtual-ui.cjs"),
    mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(result.outputFiles[0].text, filename);
  const C = mod.exports;
  const render = (name, props = {}, url = "/", pattern = "*") =>
    renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: [url] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: pattern,
            element: React.createElement(C[name], props),
          }),
        ),
      ),
    );
  const reset = () => {
    globalThis.ui = {
      user: { id: "resident", role: "RESIDENT", tower: "A", flatNumber: "101" },
      data: {},
    };
  };
  let passed = 0;
  const check = (name, fn) => {
    reset();
    fn();
    passed++;
    console.log("PASS " + name);
  };
  const notice = {
    id: "notice-1",
    title: "Water supply update",
    content: "Full details <script>unsafe</script>\nSecond paragraph",
    category: "Maintenance",
    isPinned: true,
    createdAt: "2026-11-06T10:00:00Z",
    updatedAt: "2026-11-06T10:00:00Z",
    author: { name: "Management" },
  };
  const event = {
    id: "event-1",
    title: "Community gathering",
    description: "Complete gathering description",
    startsAt: "2026-11-20T12:30:00Z",
    location: "Society hall",
    creatorId: "resident",
    creator: { name: "Host", tower: "A", flatNumber: "101" },
  };
  check(
    "Society retains full geometry without viewer controls or surrounding UI",
    () => {
      const h = render("Courtyard", {
        towers: ["A", "A", "B"],
        registeredFlats: 2,
      });

      assert.match(h, /model-front/);
      assert.match(h, /model-back/);
      assert.equal((h.match(/class="model-building"/g) || []).length,3);
      for (const scenePart of ["model-garden","model-road","model-walking-path","model-parking","model-car","model-gate","model-security","model-recreation","model-tree"])
        assert.match(h,new RegExp(scenePart));
      assert.doesNotMatch(
        h,
        /Select a tower|Choose a tower|Inspect Tower|tower-tabs/,
      );

      assert.doesNotMatch(h, /<button|<header|<footer|model-controls|model-help|recorded towers|registered flats|Pause|Zoom|Pan mode|Reset camera/);
      assert.match(h, /model-moving-vehicle/);
      assert.doesNotMatch(render("Courtyard"), /Tower A/);
    },
  );
  check(
    "Home shows every notice once, detail links, no service redirects",
    () => {
      ui.data["/society"] = {
        society: { name: "Recorded Society" },
        towers: ["A"],
        registeredFlats: 2,
      };
      ui.data["/events?upcoming=true&limit=3"] = { items: [] };
      ui.notices = {
        items: [
          notice,
          { ...notice, id: "notice-2", title: "Second announcement" },
        ],
      };
      const h = render("Home");
      assert.equal((h.match(/href="\/notices\/notice-1"/g) || []).length, 1);
      assert.match(h, /href="\/notices\/notice-2"/);
      assert.match(h, /home-focus-grid/);
      assert.doesNotMatch(
        h,
        /home-services|href="\/billing"|href="\/complaints"/,
      );
    },
  );
  check(
    "Dashboard renders supplied counts, safe zero state and detail links",
    () => {
      ui.data["/dashboard"] = {
        totalComplaints: 8,
        byStatus: { OPEN: 3, IN_PROGRESS: 4, RESOLVED: 1 },
      };
      ui.data["/complaints?limit=5"] = { items: [] };
      ui.data["/notices?limit=5&sort=latest"] = { items: [notice] };
      const h = render("Dashboard");
      assert.match(h, /metric-value">8</);
      assert.match(h, /50% of complaints/);
      assert.match(h, /href="\/notices\/notice-1"/);
      ui.data["/dashboard"] = {
        totalComplaints: 0,
        byStatus: { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 },
      };
      assert.doesNotMatch(render("Dashboard"), /NaN|Infinity/);
    },
  );
  check(
    "Notice detail has full content, metadata and escaped user text",
    () => {
      ui.data["/notices/notice-1"] = notice;
      const h = render("NoticeDetail", {}, "/notices/notice-1", "/notices/:id");
      assert.match(h, /<h1>Water supply update<\/h1>/);
      assert.match(h, /Second paragraph/);
      assert.match(h, /Maintenance/);
      assert.match(h, /&lt;script&gt;unsafe/);
      assert.doesNotMatch(h, /<script>/);
    },
  );
  check(
    "Event details retain creator management and published metadata",
    () => {
      ui.data["/events/event-1"] = event;
      let h = render("EventDetail", {}, "/events/event-1", "/events/:id");
      assert.match(h, /Complete gathering description/);
      assert.match(h, /Society hall/);
      assert.match(h, /Host/);
      assert.match(h, /href="\/events\/event-1\/edit"/);
      ui.user.id = "other";
      assert.doesNotMatch(
        render("EventDetail", {}, "/events/event-1", "/events/:id"),
        /Edit event|Remove event/,
      );
    },
  );
  check("Events link to details and hide pagination for a single page", () => {
    ui.data["/events?page=1&upcoming=true"] = {
      items: [event],
      hasNext: false,
    };
    let h = render("Events");
    assert.match(h, /href="\/events\/event-1"/);
    assert.doesNotMatch(h, /aria-label="Event pages"/);
    ui.data["/events?page=1&upcoming=true"].hasNext = true;
    assert.match(render("Events"), /aria-label="Event pages"/);
  });
  check(
    "Chat preserves sender, attachment, reply and moderation rendering",
    () => {
      ui.feed = {
        items: [
          {
            id: "message-1",
            senderId: "resident",
            sender: {
              name: "Resident",
              role: "RESIDENT",
              tower: "A",
              flatNumber: "101",
            },
            body: "Hello <script>bad</script>",
            createdAt: "2026-11-06T10:00:00Z",
            imageUrl: "https://example.test/image.jpg",
            replyTo: { unavailable: true },
          },
        ],
      };
      const h = render("Community");
      assert.match(h, /chat-message-own/);
      assert.match(h, /Original message removed/);
      assert.match(h, /Community attachment/);
      assert.match(h, /Unit A \/ 101/);
      assert.match(h, /aria-label="Send message"/);
      assert.match(h, /About this group/);
      assert.match(h, /Authenticated society residents and administrators/);
      assert.doesNotMatch(h, /<script>|Remove message/);
      ui.user.role = "ADMIN";
      assert.match(render("Community"), /Remove/);
    },
  );
  check(
    "Complaint archive and delete actions distinguish lifecycle states",
    () => {
      let h = render("Archive", { id: "test" });
      assert.match(h, /Archive complaint/);
      assert.match(h, /history and archive reason will remain available/);
      assert.match(render("Archive", {id:"test",archived:true}), /Delete archived complaint/);
      assert.match(render("Archive", {id:"test",archived:true}), /audit history will be retained/);
      ui.user.role = "ADMIN";
      assert.match(render("Archive", { id: "test" }), /Archive complaint/);
    },
  );
  check(
    "Navigation has Home logo, mobile disclosure and role-scoped admin link",
    () => {
      const h = render("Navbar", { collapsed: false, onToggle: () => {} });
      assert.match(h, /aria-label="SocietyCare Home"/);
      assert.match(h, /aria-controls="main-navigation"/);
      assert.match(h, /aria-expanded="false"/);
      assert.doesNotMatch(h, /Admin Management/);
      assert.doesNotMatch(h, /Maintenance &amp; Billing|Dashboard/);
      ui.user.role = "ADMIN";
      const adminNav = render("Navbar", { collapsed: true, onToggle: () => {} });
      assert.match(adminNav, /Admin Management/);
      assert.match(adminNav, /Dashboard/);
      assert.doesNotMatch(adminNav, /Maintenance &amp; Billing/);
    },
  );
  check("Archived complaint route selects the archive filter for residents", () => {
    const h=render("Complaints",{},"/complaints?archived=true");
    assert.match(h,/<h1>Archived Complaints<\/h1>/);
    assert.match(h,/aria-pressed="true"[^>]*>Archived complaints/);
    assert.match(render("Complaints",{},"/complaints"),/aria-pressed="true"[^>]*>Active complaints/);
  });
  check("Directory exposes View/Edit and restricts role/delete controls", () => {
    ui.user.role="ADMIN";
    ui.accounts=[{id:"resident",name:"Current admin",role:"ADMIN"},{id:"disabled",name:"Former member",role:"RESIDENT",disabled:true},{id:"eligible",name:"Active member",role:"RESIDENT"}];
    const h=render("UserManagement");
    assert.equal((h.match(/Delete user<\/button>/g)||[]).length,2);
    assert.equal((h.match(/Promote<\/button>/g)||[]).length,1);
    assert.match(h,/Deactivated/);
    assert.match(h,/Edit profile/);
    assert.match(h,/href="\/admin\/residents\/eligible"/);
  });
  check("Retained content renders without deleted account relationships", () => {
    ui.data["/events/event-1"]={...event,creator:null,creatorId:null};
    assert.match(render("EventDetail",{},"/events/event-1","/events/:id"),/Deleted account/);
    ui.data["/notices/notice-1"]={...notice,author:null};
    assert.match(render("NoticeDetail",{},"/notices/notice-1","/notices/:id"),/Deleted account/);
    ui.feed={items:[{id:"retained",senderId:null,sender:null,body:"Retained discussion",createdAt:"2026-11-07T10:00:00Z",replyTo:{body:"Original",sender:null}}]};
    const h=render("Community");assert.match(h,/Deleted account/);assert.match(h,/Retained discussion/);
  });
  check("Shared dialog renders native labelled modal structure", () => {
    const h = render("Dialog", {
      open: false,
      label: "Photo evidence",
      onClose: () => {},
      children: React.createElement("button", null, "Close"),
    });
    assert.match(h, /<dialog/);
    assert.match(h, /aria-label="Photo evidence"/);
    assert.match(h, /<button>Close/);
  });
  const asset = { id: 'asset-1', name: 'Passenger lift', assetCode: 'LIFT-A-01', location: 'Tower A lobby', category: 'Lift', description: '<script>unsafe</script>', qrToken: 'a'.repeat(43), status: 'ACTIVE', createdAt: '2026-11-13T10:00:00Z', updatedAt: '2026-11-13T10:00:00Z' };
  check('Assets render cards, pagination, empty and retry states', () => {
    ui.data['/assets?page=1'] = { items: [asset], total: 1, hasNext: false };
    const h = render('Assets');
    assert.match(h, /href="\/assets\/asset-1"/); assert.match(h, /LIFT-A-01/); assert.match(h, /Tower A lobby/); assert.match(h, /Active/); assert.doesNotMatch(h, /Asset pages/);
    ui.data['/assets?page=1'].hasNext = true; assert.match(render('Assets'), /Asset pages/);
    ui.data['/assets?page=1'] = { items: [], total: 0 }; assert.match(render('Assets'), /No assets registered yet/);
    delete ui.data['/assets?page=1']; assert.match(render('Assets'), /Loading/);
    ui.errors = { '/assets?page=1': 'Unable to load assets' }; assert.match(render('Assets'), /Retry/);
  });
  check('Asset details escape content and generate token-based reporting URL', () => {
    const previous = globalThis.window;
    globalThis.window = { location: { origin: 'https://society.example' } };
    try {
      ui.data['/assets/asset-1'] = asset;
      const h = render('AssetDetail', {}, '/assets/asset-1', '/assets/:id');
      assert.match(h, /https:\/\/society.example\/report\/a{43}/); assert.doesNotMatch(h, /report\/asset-1/);
      assert.match(h, /&lt;script&gt;/); assert.match(h, /Deactivate asset/); assert.match(h, /Delete asset/); assert.match(h, /Print QR/); assert.match(h, /Scan to report a fault/);
      ui.data['/assets/asset-1'] = { ...asset, status: 'INACTIVE' }; assert.match(render('AssetDetail', {}, '/assets/asset-1', '/assets/:id'), /Activate asset/);
      delete ui.data['/assets/asset-1']; ui.errors = { '/assets/asset-1': 'Asset not found.' }; assert.match(render('AssetDetail', {}, '/assets/asset-1', '/assets/:id'), /Asset not found/);
    } finally { globalThis.window = previous; }
  });
  check('Asset editor labels fields and navigation remains admin-only', () => {
    const h = render('AssetEditor', {}, '/assets/new');
    for (const field of ['name', 'assetCode', 'location', 'category', 'description']) assert.match(h, new RegExp('name="' + field + '"'));
    assert.match(h, /Create asset/); assert.match(h, /Cancel/);
    assert.doesNotMatch(render('Navbar'), /Asset Management/);
    ui.user.role = 'ADMIN'; assert.match(render('Navbar'), /Asset Management/);
  });
  check('Admin complaint integration exposes source, linked equipment and real asset history', () => {
    ui.user.role = 'ADMIN';
    const complaint = {
      id: 'complaint-1', title: 'Lift stopped', category: 'LIFT', priority: 'HIGH', status: 'OPEN',
      source: 'QR', createdAt: '2026-11-14T10:00:00Z', resident: { name: 'Resident', flatNumber: '101' },
      asset: { id: asset.id, name: asset.name, assetCode: asset.assetCode },
    };
    const qr = render('ComplaintSource', { source: 'QR' });
    assert.match(qr, /QR/); assert.match(render('ComplaintSource', { source: 'MANUAL' }), /Manual/);
    const row = render('ComplaintCard', { complaint, showAsset: true });
    assert.match(row, /href="\/assets\/asset-1"/);
    const noAsset = render('ComplaintCard', { complaint: { ...complaint, asset: null }, showAsset: true });
    assert.match(noAsset, /Not linked to an asset/);
    ui.data['/assets/asset-1/complaints?page=1'] = {
      items: [complaint], totalItems: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false,
      byStatus: { OPEN: 1, IN_PROGRESS: 0, RESOLVED: 0 },
    };
    const history = render('AssetHistory', { assetId: asset.id });
    assert.match(history, /Complaint History/); assert.match(history, /Lift stopped/); assert.match(history, /Total/); assert.match(history, /QR/);
    ui.data['/dashboard'] = {
      totalComplaints: 1, overdueCount: 0, byStatus: { OPEN: 1, IN_PROGRESS: 0, RESOLVED: 0 },
      assets: { active: 3, inactive: 1, qrComplaints: 1, openComplaints: 1, mostReported: [{ id: asset.id, name: asset.name, assetCode: asset.assetCode, complaintCount: 1 }] },
    };
    ui.data['/complaints?limit=5'] = { items: [complaint] };
    ui.data['/notices?limit=5&sort=latest'] = { items: [] };
    const dashboard = render('Dashboard');
    for (const label of ['Active assets', 'Inactive assets', 'QR complaints', 'Open asset complaints', 'Most reported equipment']) assert.match(dashboard, new RegExp(label));
    assert.match(dashboard, /Passenger lift/); assert.match(dashboard, /QR · Passenger lift · LIFT-A-01/);
  });
  check('QR form displays immutable equipment and reuses existing complaint/photo fields', () => {
    const h = render('QRComplaintForm', { qrToken: 'q'.repeat(43), asset, token: 'test-only' });
    assert.equal((h.match(/readOnly=""/g)||[]).length, 2);
    for (const field of ['title','description','priority','photo']) assert.match(h, new RegExp('name="'+field+'"'));
    for (const field of ['assetId','residentId','societyId','category','source']) assert.doesNotMatch(h, new RegExp('name="'+field+'"'));
    assert.match(h, /Submit Complaint/); assert.match(h, /up to 5 MB/);
  });
  console.log(
    passed +
      " component rendering checks passed (no browser interactions executed).",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

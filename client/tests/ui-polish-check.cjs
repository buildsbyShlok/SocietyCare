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
        'export {default as Billing,InvoiceDetail} from "./src/pages/Billing";',
        'export {default as Notices} from "./src/components/HomeAnnouncements";',
        'export {default as NoticeDetail} from "./src/pages/NoticeDetail";',
        'export {default as Events,EventDetail} from "./src/pages/Events";',
        'export {default as Community} from "./src/pages/Community";',
        'export {default as Archive} from "./src/components/ArchiveComplaint";',
        'export {ResidentRecord} from "./src/components/ResidentRecord";',
        'export {default as Navbar} from "./src/components/Navbar";',
        'export {default as Dialog} from "./src/components/Dialog";',
        'export {default as Complaints} from "./src/pages/Complaints";',
        'export {default as UserManagement} from "./src/pages/UserManagement";',
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
  const bill = {
    id: "invoice-1",
    month:
      new Date().getFullYear() +
      "-" +
      String(new Date().getMonth() + 1).padStart(2, "0"),
    amount: "1234.56",
    resident: { name: "Resident" },
    tower: "A",
    flatNumber: "101",
    dueDate: "2026-11-20",
    createdAt: "2026-11-01T10:00:00Z",
    status: "PENDING",
    payment: null,
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
    "Invoice register links, cent-accurate totals and full paid receipt",
    () => {
      ui.data["/billing"] = { items: [bill] };
      const h = render("Billing");
      assert.match(h, /href="\/billing\/invoice-1"/);
      assert.match(h, /1,234\.56/);
      assert.match(h, /Flat A \/ 101/);
      let detail = render(
        "InvoiceDetail",
        {},
        "/billing/invoice-1",
        "/billing/:id",
      );
      assert.match(detail, /Balance due/);
      assert.doesNotMatch(detail, /Verify full payment/);
      ui.data["/billing"].items[0] = {
        ...bill,
        status: "PAID",
        payment: {
          id: "receipt-1",
          reference: "bank-1",
          paidAt: "2026-11-06T10:00:00Z",
        },
      };
      detail = render(
        "InvoiceDetail",
        {},
        "/billing/invoice-1",
        "/billing/:id",
      );
      assert.match(detail, /receipt-1/);
      assert.match(detail, /bank-1/);
      assert.match(detail, /Balance due<\/span><strong>₹0\.00/);
    },
  );
  check(
    "Invoice missing, loading and error states; only admin can verify",
    () => {
      ui.data["/billing"] = { items: [bill] };
      ui.user.role = "ADMIN";
      assert.match(
        render("InvoiceDetail", {}, "/billing/invoice-1", "/billing/:id"),
        /Verify full payment/,
      );
      assert.match(
        render("InvoiceDetail", {}, "/billing/other", "/billing/:id"),
        /Invoice not found/,
      );
      delete ui.data["/billing"];
      assert.match(render("InvoiceDetail"), /Loading/);
      ui.errors = { "/billing": "Connection failed" };
      assert.match(render("InvoiceDetail"), /role="alert"/);
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
    "Private profile renders actual supplied receipts and invoice links",
    () => {
      ui.data["/users/resident/record"] = {
        ...ui.user,
        name: "Resident",
        email: "resident@example.test",
        createdAt: "2026-11-01",
        complaints: [],
        bills: [
          {
            ...bill,
            payment: {
              id: "receipt-real",
              reference: "reference-real",
              paidAt: "2026-11-06",
            },
          },
        ],
      };
      const h = render("ResidentRecord", { id: "resident", details: true });
      assert.match(h, /Maintenance payment history/);
      assert.match(h, /receipt-real/);
      assert.match(h, /reference-real/);
      assert.match(h, /href="\/billing\/invoice-1"/);
      ui.data["/users/resident/record"].bills = [];
      assert.match(
        render("ResidentRecord", { id: "resident" }),
        /No verified maintenance payments/,
      );
      delete ui.data["/users/resident/record"];
      ui.errors = { "/users/resident/record": "This profile is private." };
      assert.doesNotMatch(
        render("ResidentRecord", { id: "resident" }),
        /receipt-real/,
      );
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
      ui.user.role = "ADMIN";
      assert.match(
        render("Navbar", { collapsed: true, onToggle: () => {} }),
        /Admin Management/,
      );
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
    ui.data["/billing"]={items:[{...bill,resident:null}]};
    assert.match(render("InvoiceDetail",{},"/billing/invoice-1","/billing/:id"),/Deleted account/);
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
  console.log(
    passed +
      " component rendering checks passed (no browser interactions executed).",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

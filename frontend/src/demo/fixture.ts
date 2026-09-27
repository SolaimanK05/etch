// Scan of the demo shop app (demo-app/ at its four planted violations),
// recorded with the real backend scanner. The hosted demo serves it instead of /api/scan.
import type { ArchGraph } from "../types";

export const DEMO_GRAPH: ArchGraph = {
  "root_package": "shop",
  "layers": [
    {
      "id": "api",
      "module": "shop.api",
      "files": 3
    },
    {
      "id": "db",
      "module": "shop.db",
      "files": 4
    },
    {
      "id": "notifications",
      "module": "shop.notifications",
      "files": 3
    },
    {
      "id": "services",
      "module": "shop.services",
      "files": 4
    }
  ],
  "dependencies": [
    {
      "source": "api",
      "target": "db",
      "imports": [
        {
          "importer": "shop.api.orders",
          "imported": "shop.db.orders_repo",
          "file": "shop/api/orders.py",
          "line": 3,
          "code": "from shop.db.orders_repo import get_order"
        }
      ]
    },
    {
      "source": "api",
      "target": "notifications",
      "imports": [
        {
          "importer": "shop.api.users",
          "imported": "shop.notifications.email",
          "file": "shop/api/users.py",
          "line": 8,
          "code": "from shop.notifications.email import send_welcome"
        }
      ]
    },
    {
      "source": "api",
      "target": "services",
      "imports": [
        {
          "importer": "shop.api.orders",
          "imported": "shop.services.orders",
          "file": "shop/api/orders.py",
          "line": 4,
          "code": "from shop.services.orders import place_order"
        },
        {
          "importer": "shop.api.users",
          "imported": "shop.services.users",
          "file": "shop/api/users.py",
          "line": 3,
          "code": "from shop.services.users import get_profile, register_user"
        }
      ]
    },
    {
      "source": "db",
      "target": "services",
      "imports": [
        {
          "importer": "shop.db.orders_repo",
          "imported": "shop.services.pricing",
          "file": "shop/db/orders_repo.py",
          "line": 4,
          "code": "from shop.services.pricing import apply_discount"
        }
      ]
    },
    {
      "source": "notifications",
      "target": "db",
      "imports": [
        {
          "importer": "shop.notifications.email",
          "imported": "shop.db.users_repo",
          "file": "shop/notifications/email.py",
          "line": 4,
          "code": "from shop.db.users_repo import get_user_email"
        }
      ]
    },
    {
      "source": "services",
      "target": "db",
      "imports": [
        {
          "importer": "shop.services.orders",
          "imported": "shop.db.orders_repo",
          "file": "shop/services/orders.py",
          "line": 3,
          "code": "from shop.db import orders_repo"
        },
        {
          "importer": "shop.services.users",
          "imported": "shop.db.users_repo",
          "file": "shop/services/users.py",
          "line": 3,
          "code": "from shop.db import users_repo"
        }
      ]
    },
    {
      "source": "services",
      "target": "notifications",
      "imports": [
        {
          "importer": "shop.services.orders",
          "imported": "shop.notifications.email",
          "file": "shop/services/orders.py",
          "line": 4,
          "code": "from shop.notifications.email import send_order_confirmation"
        }
      ]
    }
  ]
};

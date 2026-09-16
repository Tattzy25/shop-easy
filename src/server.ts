import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import globalsearchMd from "./globalsearch.md?raw";
import storefrontMd from "./storefrontsearch.md?raw";
import { z } from "zod";

// ==========================================
// GLOBAL CATALOG SCHEMAS
// ==========================================

const globalGetLlmsDocsInputSchema = z.object({});

const globalSearchCatalogInputSchema = z.object({
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  catalog: z
    .object({
      query: z
        .string()
        .describe("Free-text search query. For example, \"trail running shoes\", \"organic coffee beans\".")
        .optional(),
      catalog_id: z
        .string()
        .describe("ID of a catalog configuration saved in the Dev Dashboard. Its filters set the request boundaries: values within them narrow the results, while values outside them fall back to the saved filters. The saved query prefix is prepended to catalog.query, combining both queries. Promoted placement can be enabled for saved catalog, refer to Earn with promoted placements for setup, payouts, and disclosure details.")
        .optional(),
      saved_catalog_slug: z
        .string()
        .describe("Deprecated compatibility alias for catalog.catalog_id. Use catalog.catalog_id for new integrations. If you pass both fields, then catalog.catalog_id takes precedence.")
        .optional(),
      like: z
        .array(z.object({}).passthrough())
        .describe("Similar item to search by. Use either an item reference or image content. Pass both catalog.query and an image in catalog.like for multimodal search. Multimodal search uses the text query to describe what the agent is looking for and the image to provide visual context, such as style, shape, or pattern. Pass only an image for visual similarity search, which returns items that visually resemble the image without additional text intent.")
        .optional(),
      context: z
        .object({
          address_country: z.string().optional(),
          address_region: z.string().optional(),
          postal_code: z.string().optional(),
          language: z.string().optional(),
          currency: z.string().optional(),
          intent: z.string().optional()
        })
        .describe("Buyer signals for relevance and localization (address_country, address_region, postal_code, language, currency, and intent).")
        .optional(),
      filters: z
        .object({
          available: z
            .boolean()
            .describe("Filter by availability. Defaults to true (only sale-ready items). Set to false to include unavailable items."),
          ships_to: z
            .object({
              country: z.string().optional(),
              region: z.string().optional(),
              postal_code: z.string().optional()
            })
            .describe("Filter to products that ship to a given location. Accepts country (ISO 3166-1 alpha-2), region, and postal_code."),
          ships_from: z
            .array(
              z.object({
                country: z.string().describe("Merchant origin country (ISO 3166-1 alpha-2).")
              })
            )
            .describe("Filter by merchant origin country. Each entry accepts country (ISO 3166-1 alpha-2). Multiple entries use OR logic. Digital products that don't require shipping can still match this filter."),
          price: z
            .object({
              min: z.number().int().optional(),
              max: z.number().int().optional()
            })
            .describe("Price range in minor currency units. Accepts min and max integers. For example, {\"min\": 5000, \"max\": 20000} = $50.00–$200.00 USD."),
          condition: z
            .array(z.string())
            .describe("Product condition filter. Known values: \"new\", \"secondhand\". Multiple values use OR logic."),
          shops: z
            .array(z.string())
            .describe("Filter to specific shops. Accepts an array of shop GIDs, for example gid://shopify/Shop/987654321. You can pass up to 1000 shop IDs per request."),
          attributes: z
            .array(z.object({}).passthrough())
            .describe("Filter by Shopify taxonomy attributes. Supported names are Color, Size, and Target gender. Entries combine with AND logic. Values within one entry combine with OR logic. Unsupported attribute names are ignored and returned in messages."),
          rating: z
            .object({
              variant: z
                .object({
                  min: z.number().min(0).max(5).optional().describe("The minimum rating value (0–5 scale)."),
                  min_count: z.number().int().min(0).optional().describe("The minimum number of reviews.")
                })
            })
            .describe("Filter by variant rating. variant matches products with at least one variant whose rating meets the given thresholds. Set variant.min for the minimum rating value (0–5 scale) and variant.min_count for the minimum number of reviews."),
          price_tier: z
            .array(z.string())
            .describe("Filter by relative price tier within each product's category. Supported values are low, medium, and high. Multiple values use OR logic. Unsupported values are ignored and returned in messages."),
          categories: z
            .array(
              z.object({
                id: z.string().describe("The taxonomy ID."),
                taxonomy: z.string().optional().describe("The taxonomy source. Defaults to Shopify's standard taxonomy.")
              })
            )
            .describe("Filter by product category using taxonomy IDs. Each item accepts id (required) and taxonomy (optional, defaults to Shopify's standard taxonomy). Multiple values use OR logic.")
        })
        .optional(),
      view: z
        .string()
        .describe("Predefined output shape for the response. Use \"offer\" for comparison shopping. When absent, the server returns its default shape.")
        .optional(),
      pagination: z
        .object({
          cursor: z
            .string()
            .describe("Opaque cursor from a previous response. Pass the returned pagination.cursor as catalog.pagination.cursor to request the next page.")
            .optional(),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .describe("Page size. Integer, min 1, default 10, max 50. You can paginate up to 1,000 results. Beyond that depth, has_next_page is false regardless of how many results match.")
            .optional()
        })
        .describe("Cursor-based pagination controls. The cursor carries only the next result offset, so the request's limit controls page size. The total_count field in the response is an estimate of how many results match the query, not an exact count. Don't rely on it for precise totals or to calculate an exact number of pages.")
        .optional()
    })
    .describe("The catalog object containing the search parameters. All parameters are wrapped in a catalog object. Refer to the UCP catalog search spec for the complete schema.")
});

const globalLookupCatalogInputSchema = z.object({
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  catalog: z
    .object({
      ids: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe("Array of product or variant identifiers (1 to 50). Accepts gid://shopify/p/{upid}, gid://shopify/ProductVariant/{id}, and http or https Shopify product URLs. Multiple IDs that resolve to the same product are grouped into a single product in the response."),
      filters: z
        .object({
          available: z
            .boolean()
            .describe("Filter by availability. Defaults to true (only sale-ready items). Set to false to include unavailable items."),
          ships_to: z
            .object({
              country: z.string().optional(),
              region: z.string().optional(),
              postal_code: z.string().optional()
            })
            .describe("Filter to products that ship to a given location. Accepts country, region, and postal_code."),
          ships_from: z
            .array(
              z.object({
                country: z.string().describe("Merchant origin country (ISO 3166-1 alpha-2).")
              })
            )
            .describe("Filter by merchant origin country. Each entry accepts country (ISO 3166-1 alpha-2). Multiple entries use OR logic. Digital products that don't require shipping can still match this filter."),
          condition: z
            .array(z.string())
            .describe("Product condition filter. Known values: \"new\", \"secondhand\". Multiple values use OR logic."),
          shops: z
            .array(z.string())
            .describe("Filter to specific shops. Accepts an array of shop GIDs, for example gid://shopify/Shop/987654321. You can pass up to 1000 shop IDs per request.")
        })
        .optional(),
      context: z
        .object({
          address_country: z.string().optional(),
          address_region: z.string().optional(),
          postal_code: z.string().optional(),
          language: z.string().optional(),
          currency: z.string().optional(),
          intent: z.string().optional()
        })
        .describe("Buyer context for localization (address_country, address_region, postal_code, language, currency, and intent).")
        .optional(),
      view: z
        .string()
        .describe("Predefined output shape for the response. Use \"offer\" for comparison shopping. When absent, the server returns its default shape.")
        .optional()
    })
    .describe("The catalog object containing the lookup parameters. All parameters are wrapped in a catalog object. Refer to the UCP catalog lookup spec for the complete schema.")
});

const globalGetProductInputSchema = z.object({
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  catalog: z
    .object({
      id: z
        .string()
        .describe("Product or variant identifier. Accepts gid://shopify/p/{upid} or gid://shopify/ProductVariant/{id}."),
      selected: z
        .array(
          z.object({
            name: z.string().describe("The option name, e.g. \"Color\" or \"Size\"."),
            label: z.string().describe("The option value label, e.g. \"Blue\" or \"10\".")
          })
        )
        .describe("Option selections for variant narrowing. For example, [{\"name\": \"Color\", \"label\": \"Blue\"}, {\"name\": \"Size\", \"label\": \"10\"}]. The response reflects these selections in product.selected and filters the returned variants accordingly.")
        .optional(),
      preferences: z
        .array(z.string())
        .describe("Option names in relaxation priority order. When an exact match isn't available, options are dropped from the end of this list first. For example, [\"Color\", \"Size\"] drops Size before Color.")
        .optional(),
      filters: z
        .object({
          ships_to: z
            .object({
              country: z.string().optional(),
              region: z.string().optional(),
              postal_code: z.string().optional()
            })
            .describe("Filter to products that ship to a given location. Accepts country, region, and postal_code."),
          ships_from: z
            .array(
              z.object({
                country: z.string().describe("Merchant origin country (ISO 3166-1 alpha-2).")
              })
            )
            .describe("Filter by merchant origin country. Each entry accepts country (ISO 3166-1 alpha-2). Multiple entries use OR logic. Digital products that don't require shipping can still match this filter."),
          available: z
            .boolean()
            .describe("Filter by availability. Defaults to true (only sale-ready items). Set to false to include unavailable items."),
          condition: z
            .array(z.string())
            .describe("Product condition filter. Known values: \"new\", \"secondhand\". Multiple values use OR logic."),
          shops: z
            .array(z.string())
            .describe("Filter to specific shops. Accepts an array of shop GIDs, for example gid://shopify/Shop/987654321. You can pass up to 1000 shop IDs per request.")
        })
        .optional(),
      context: z
        .object({
          address_country: z.string().optional(),
          address_region: z.string().optional(),
          postal_code: z.string().optional(),
          language: z.string().optional(),
          currency: z.string().optional(),
          intent: z.string().optional()
        })
        .describe("Buyer context for localization (address_country, address_region, postal_code, language, currency, and intent).")
        .optional(),
      view: z
        .string()
        .describe("Predefined output shape for the response. Use \"summary\" for a condensed product detail view. When absent, the server returns its default shape.")
        .optional()
    })
    .describe("The catalog object containing the product lookup parameters. All parameters are wrapped in a catalog object. Refer to the UCP catalog lookup spec for the complete schema.")
});

// ==========================================
// STOREFRONT CATALOG SCHEMAS
// ==========================================

const getLlmsDocsInputSchema = z.object({});

const searchCatalogInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  catalog: z
    .object({
      query: z
        .string()
        .describe("Free-text search query. For example, \"organic coffee beans\", \"winter jacket\".")
        .optional(),
      context: z
        .object({
          address_country: z.string().optional().describe("Localization hint for the buyer country."),
          language: z.string().optional().describe("Localization hint for the buyer language."),
          currency: z.string().optional().describe("Localization hint for the buyer currency."),
          intent: z.string().optional().describe("The buyer's intent or shopping context.")
        })
        .describe("Buyer signals for relevance and localization (address_country, language, currency, and intent).")
        .optional(),
      filters: z
        .object({
          available: z
            .boolean()
            .describe("Filter by availability. Defaults to true (only sale-ready items). Set to false to include unavailable items.")
        })
        .describe("Availability filter. When true (default), only sale-ready items are returned. Set to false to include unavailable items.")
        .optional(),
      pagination: z
        .object({
          cursor: z
            .string()
            .describe("Opaque cursor from a previous response. Pass the returned pagination.cursor as catalog.pagination.cursor to request the next page.")
            .optional(),
          limit: z
            .number()
            .int()
            .min(1)
            .max(250)
            .describe("Page size. Integer, min 1, default 10, max 250.")
            .optional()
        })
        .describe("Cursor-based pagination controls. The cursor carries only the next result offset, so the request's limit controls page size.")
        .optional()
    })
    .describe("The catalog object containing the search parameters. All parameters are wrapped in a catalog object. Refer to the UCP catalog search spec for the complete schema.")
});

const lookupCatalogInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  catalog: z
    .object({
      ids: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Array of product or variant identifiers (up to 10). For example, \"gid://shopify/Product/123\"."),
      context: z
        .object({
          address_country: z.string().optional().describe("Localization hint for the buyer country."),
          language: z.string().optional().describe("Localization hint for the buyer language."),
          currency: z.string().optional().describe("Localization hint for the buyer currency."),
          intent: z.string().optional().describe("The buyer's intent or shopping context.")
        })
        .describe("Buyer context for localization (address_country, language, currency, and intent).")
        .optional()
    })
    .describe("The catalog object containing the lookup parameters. All parameters are wrapped in a catalog object. Refer to the UCP catalog lookup spec for the complete schema.")
});

const getProductInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  catalog: z
    .object({
      id: z
        .string()
        .describe("Product or variant identifier. For example, \"gid://shopify/Product/123\"."),
      selected: z
        .array(
          z.object({
            name: z.string().describe("The option name, e.g. \"Color\" or \"Size\"."),
            label: z.string().describe("The option value label, e.g. \"Blue\" or \"10\".")
          })
        )
        .describe("Option selections for variant narrowing. For example, [{\"name\": \"Color\", \"label\": \"Blue\"}]. The response reflects these selections in product.selected and filters the returned variants accordingly.")
        .optional(),
      context: z
        .object({
          address_country: z.string().optional().describe("Localization hint for the buyer country."),
          language: z.string().optional().describe("Localization hint for the buyer language."),
          currency: z.string().optional().describe("Localization hint for the buyer currency."),
          intent: z.string().optional().describe("The buyer's intent or shopping context.")
        })
        .describe("Buyer context for localization (address_country, language, currency, and intent).")
        .optional()
    })
    .describe("The catalog object containing the product lookup parameters. All parameters are wrapped in a catalog object. Refer to the UCP catalog lookup spec for the complete schema.")
});

// ==========================================
// CART SCHEMAS
// ==========================================

const createCartInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  cart: z
    .object({
      line_items: z
        .array(
          z.object({
            quantity: z
              .number()
              .int()
              .min(1)
              .describe("The quantity to add for this line item."),
            item: z.object({
              id: z
                .string()
                .describe("The product variant id for this line item.")
            })
          })
        )
        .describe(
          "Array of items to add to the cart. Each item must include quantity and an item object with the product variant id."
        ),
      context: z
        .object({
          address_country: z.string().optional().describe("Localization hint for the buyer country."),
          address_region: z.string().optional().describe("Localization hint for the buyer region."),
          postal_code: z.string().optional().describe("Localization hint for the buyer postal code.")
        })
        .describe(
          "Localization hints including address_country, address_region, and postal_code. Merchants may use these as a signal for pricing, availability, and currency estimates, but context is not authoritative for shipping. If omitted, the merchant falls back to geo-IP."
        )
        .optional(),
      attribution: z
        .object({
          referring_domain: z.string().optional(),
          click_id_tag: z.string().optional(),
          click_id_value: z.string().optional(),
          activity_id_tag: z.string().optional(),
          activity_id_value: z.string().optional(),
          utm_campaign: z.string().optional(),
          utm_source: z.string().optional(),
          utm_medium: z.string().optional(),
          utm_content: z.string().optional(),
          utm_term: z.string().optional()
        })
        .describe(
          "Optional attribution metadata. Supported fields include referring_domain, click_id_tag, click_id_value, activity_id_tag, activity_id_value, utm_campaign, utm_source, utm_medium, utm_content, and utm_term."
        )
        .optional(),
      buyer: z
        .object({})
        .passthrough()
        .describe("Optional buyer information for personalized estimates.")
        .optional(),
      signals: z
        .object({})
        .passthrough()
        .describe("Optional platform-provided environment data for authorization and abuse prevention.")
        .optional()
    })
    .describe("The cart object containing the cart data.")
});

const getCartInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  id: z.string().describe("The ID of the cart to retrieve.")
});

const updateCartInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  id: z.string().describe("The ID of the cart to update."),
  cart: z
    .object({
      line_items: z
        .array(
          z.object({
            quantity: z
              .number()
              .int()
              .min(1)
              .describe("The full replacement quantity for this line item."),
            item: z.object({
              id: z
                .string()
                .describe("The product variant id for this line item.")
            })
          })
        )
        .describe("Full replacement array of items."),
      context: z
        .object({
          address_country: z.string().optional().describe("Localization signal for the buyer country."),
          address_region: z.string().optional().describe("Localization signal for the buyer region."),
          postal_code: z.string().optional().describe("Localization signal for the buyer postal code.")
        })
        .describe(
          "Localization signals. Context is a hint for pricing, availability, and currency and is not used as the shipping address at checkout."
        )
        .optional(),
      attribution: z
        .object({
          referring_domain: z.string().optional(),
          click_id_tag: z.string().optional(),
          click_id_value: z.string().optional(),
          activity_id_tag: z.string().optional(),
          activity_id_value: z.string().optional(),
          utm_campaign: z.string().optional(),
          utm_source: z.string().optional(),
          utm_medium: z.string().optional(),
          utm_content: z.string().optional(),
          utm_term: z.string().optional()
        })
        .describe(
          "Attribution metadata. Because the cart object is replaced, resend attribution if you want to preserve it."
        )
        .optional(),
      buyer: z
        .object({})
        .passthrough()
        .describe("Optional buyer information.")
        .optional(),
      signals: z
        .object({})
        .passthrough()
        .describe("Optional platform signals.")
        .optional()
    })
    .describe(
      "The cart object containing the full desired cart state. Any field you omit is removed from the cart. update_cart uses PUT semantics and does not merge partial updates."
    )
});

const cancelCartInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      }),
      "idempotency-key": z
        .string()
        .uuid()
        .describe("A UUID required for retry safety.")
    })
    .describe("Request metadata. You must include ucp-agent.profile and idempotency-key."),
  id: z.string().describe("The ID of the cart to cancel.")
});

// ==========================================
// CHECKOUT SCHEMAS
// ==========================================

const createCheckoutInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  cart_id: z
    .string()
    .describe(
      "The optional ID of a cart built with Cart MCP to convert into this checkout."
    )
    .optional(),
  checkout: z
    .object({
      currency: z
        .string()
        .describe("ISO 4217 currency code, for example USD, EUR, or GBP.")
        .optional(),
      line_items: z
        .array(
          z.object({
            quantity: z
              .number()
              .int()
              .min(1)
              .describe("The quantity to purchase for this line item."),
            item: z.object({
              id: z
                .string()
                .describe("The product variant id for this line item.")
            })
          })
        )
        .describe(
          "Array of items to purchase. Each item must include quantity and an item object with the product variant id."
        )
        .optional(),
      buyer: z
        .object({})
        .passthrough()
        .describe(
          "Buyer information. Contact method email or phone_number must be provided, per-merchant configuration."
        )
        .optional(),
      context: z
        .object({
          address_country: z.string().optional().describe("Provisional buyer signal for country."),
          address_region: z.string().optional().describe("Provisional buyer signal for region."),
          postal_code: z.string().optional().describe("Provisional buyer signal for postal code."),
          intent: z.string().optional().describe("Provisional buyer intent signal."),
          language: z.string().optional().describe("Provisional buyer language signal."),
          currency: z.string().optional().describe("Provisional buyer currency signal."),
          eligibility: z.array(z.string()).optional().describe("Eligibility signals.")
        })
        .describe(
          "Provisional buyer signals for intent, localization, currency, and eligibility decisions. A shipping address supersedes these context hints."
        )
        .optional(),
      attribution: z
        .object({
          referring_domain: z.string().optional(),
          click_id_tag: z.string().optional(),
          click_id_value: z.string().optional(),
          activity_id_tag: z.string().optional(),
          activity_id_value: z.string().optional(),
          utm_campaign: z.string().optional(),
          utm_source: z.string().optional(),
          utm_medium: z.string().optional(),
          utm_content: z.string().optional(),
          utm_term: z.string().optional()
        })
        .describe(
          "Optional attribution metadata. Supported fields include referring_domain, click_id_tag, click_id_value, activity_id_tag, activity_id_value, utm_campaign, utm_source, utm_medium, utm_content, and utm_term."
        )
        .optional(),
      discounts: z
        .object({
          codes: z.array(z.string()).describe("Discount codes to apply to the checkout.")
        })
        .describe(
          "Optional discount codes. Forward cart discount codes in checkout.discounts.codes during cart-to-checkout conversion."
        )
        .optional(),
      fulfillment: z
        .object({})
        .passthrough()
        .describe("Fulfillment preferences including shipping methods and destinations.")
        .optional(),
      payment: z
        .object({})
        .passthrough()
        .describe("Payment configuration including available instruments and selected_instrument_id.")
        .optional()
    })
    .describe(
      "The checkout object containing all checkout data. Optional when cart_id is provided, in which case the cart's contents are used instead."
    )
    .optional()
}).superRefine((value, ctx) => {
  if (value.cart_id) {
    return;
  }

  if (!value.checkout) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "checkout is required when cart_id is not provided.",
      path: ["checkout"]
    });
    return;
  }

  if (!value.checkout.currency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "checkout.currency is required when cart_id is not provided.",
      path: ["checkout", "currency"]
    });
  }

  if (!value.checkout.line_items) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "checkout.line_items is required when cart_id is not provided.",
      path: ["checkout", "line_items"]
    });
  }

  if (!value.checkout.buyer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "checkout.buyer is required when cart_id is not provided.",
      path: ["checkout", "buyer"]
    });
  }
});

const getCheckoutInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  id: z.string().describe("The ID of the checkout session to retrieve.")
});

const updateCheckoutInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      })
    })
    .describe("Request metadata. You must include ucp-agent.profile."),
  id: z.string().describe("The ID of the checkout session to update."),
  checkout: z
    .object({
      line_items: z
        .array(
          z.object({
            id: z
              .string()
              .describe("The existing checkout line item id.")
              .optional(),
            quantity: z
              .number()
              .int()
              .min(1)
              .describe("The updated quantity for this line item."),
            item: z.object({
              id: z
                .string()
                .describe("The product variant id for this line item.")
            })
          })
        )
        .describe("Updated array of items. Replaces existing line items."),
      buyer: z
        .object({})
        .passthrough()
        .describe(
          "Updated buyer information. Contact method email or phone_number must be provided, per-merchant configuration."
        ),
      context: z
        .object({
          address_country: z.string().optional().describe("Updated provisional buyer signal for country."),
          address_region: z.string().optional().describe("Updated provisional buyer signal for region."),
          postal_code: z.string().optional().describe("Updated provisional buyer signal for postal code."),
          intent: z.string().optional().describe("Updated provisional buyer intent signal."),
          language: z.string().optional().describe("Updated provisional buyer language signal."),
          currency: z.string().optional().describe("Updated provisional buyer currency signal."),
          eligibility: z.array(z.string()).optional().describe("Updated eligibility signals.")
        })
        .describe(
          "Updated provisional buyer signals for intent, localization, currency, and eligibility decisions. A shipping address supersedes these context hints."
        )
        .optional(),
      attribution: z
        .object({
          referring_domain: z.string().optional(),
          click_id_tag: z.string().optional(),
          click_id_value: z.string().optional(),
          activity_id_tag: z.string().optional(),
          activity_id_value: z.string().optional(),
          utm_campaign: z.string().optional(),
          utm_source: z.string().optional(),
          utm_medium: z.string().optional(),
          utm_content: z.string().optional(),
          utm_term: z.string().optional()
        })
        .describe(
          "Attribution metadata. Because the checkout object is replaced, resend attribution if you want to preserve it."
        )
        .optional(),
      discounts: z
        .object({
          codes: z.array(z.string()).describe("Updated discount codes for the checkout.")
        })
        .describe("Updated discount codes for the checkout.")
        .optional(),
      fulfillment: z
        .object({})
        .passthrough()
        .describe(
          "Updated fulfillment preferences. Each method must include line_item_ids."
        )
        .optional(),
      payment: z
        .object({})
        .passthrough()
        .describe(
          "Updated payment configuration. Do not send response-only display fields from payment.instruments."
        )
        .optional()
    })
    .describe(
      "The checkout object containing the complete updated checkout state. update_checkout uses PUT semantics. Omit a field and it is removed from the checkout. There is no server-side merge of partial updates."
    )
});

const completeCheckoutInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      }),
      "idempotency-key": z
        .string()
        .uuid()
        .describe("A UUID required for retry safety.")
    })
    .describe("Request metadata. You must include ucp-agent.profile and idempotency-key."),
  id: z.string().describe("The ID of the checkout session to complete."),
  checkout: z
    .object({
      payment: z
        .object({})
        .passthrough()
        .describe(
          "Checkout object containing payment credentials and finalization data. Include checkout.payment with the payment instrument and credential from the trusted UI."
        )
    })
    .describe("Checkout object containing payment credentials and finalization data.")
});

const cancelCheckoutInputSchema = z.object({
  shop_domain: z
    .string()
    .describe("The shop domain to call. This maps to https://{shop-domain}/api/ucp/mcp."),
  meta: z
    .object({
      "ucp-agent": z.object({
        profile: z
          .string()
          .url()
          .describe("The URI to your agent's UCP profile for capability negotiation.")
      }),
      "idempotency-key": z
        .string()
        .uuid()
        .describe("A UUID required for retry safety.")
    })
    .describe("Request metadata. You must include ucp-agent.profile and idempotency-key."),
  id: z.string().describe("The ID of the checkout session to cancel.")
});

// ==========================================
// FAQ & POLICIES SCHEMAS
// ==========================================

const searchShopPoliciesAndFaqsInputSchema = z.object({
  store_domain: z
    .string()
    .describe("The store domain to call. This maps to https://{storedomain}/api/mcp."),
  query: z
    .string()
    .describe(
      "The question about policies or FAQs. For example, 'What is your return policy for sale items?'"
    ),
  context: z
    .string()
    .describe(
      "Additional context like the current product being viewed or the customer's situation."
    )
    .optional()
});

// ==========================================
// SERVER CREATION
// ==========================================

function createServer() {
  const server = new McpServer({
    name: "unified-shopify-mcp",
    version: "1.0.0"
  });

  // --- Global Catalog Tools ---
  server.registerTool(
    "global_get_llms_docs",
    {
      description: "Returns the full documentation for the global catalog server as markdown, including all available tools, parameters, curl examples, response shapes, and the Global Catalog extension reference. Call this first to understand what this server can do and how to call its tools.",
      inputSchema: globalGetLlmsDocsInputSchema
    },
    async () => {
      return {
        content: [{ text: globalsearchMd, type: "text" }]
      };
    }
  );

  server.registerTool(
    "global_search_catalog",
    {
      description: "Searches for products across all Shopify merchants. The response conforms to the UCP catalog search response, including a UCP metadata envelope; products with title, description, price range (minor units), media, and variants. Use this when a customer asks for products matching criteria from any merchant, or wants to compare products across multiple stores. Some response fields (description, options, metadata.attributes, metadata.tech_specs, metadata.top_features, metadata.unique_selling_points, variants[].condition) are inferred by Shopify and may not always be present or may vary in accuracy. Treat them as discovery and merchandising signals, not as merchant-authored source text.",
      inputSchema: globalSearchCatalogInputSchema
    },
    async ({ meta, catalog }: z.infer<typeof globalSearchCatalogInputSchema>) => {
      const response = await fetch("https://catalog.shopify.com/api/ucp/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 2,
          params: { name: "search_catalog", arguments: { meta, catalog } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "global_lookup_catalog",
    {
      description: "Retrieves products or variants by identifier from across all Shopify merchants. The response conforms to the UCP catalog lookup response, including products with inputs correlation on each variant and not_found messages for unresolved identifiers. Use this when you have product or variant IDs from search results or deep links, need to resolve multiple identifiers in a single request, or are validating cart items against current catalog data.",
      inputSchema: globalLookupCatalogInputSchema
    },
    async ({ meta, catalog }: z.infer<typeof globalLookupCatalogInputSchema>) => {
      const response = await fetch("https://catalog.shopify.com/api/ucp/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 3,
          params: { name: "lookup_catalog", arguments: { meta, catalog } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "global_get_product",
    {
      description: "Retrieves full details for a single product with optional variant selection. The response conforms to the UCP catalog get_product response, including product.selected reflecting effective option selections, option values with available and exists signals, and variants matching the selection. Use this when a customer has selected a product and needs full details, you need to show variant options with availability signals, or a customer is making option selections (Color, Size, and so on). Some response fields (description, options, metadata.attributes, metadata.tech_specs, metadata.top_features, metadata.unique_selling_points, variants[].condition) are inferred by Shopify and may not always be present or may vary in accuracy. Treat them as discovery and merchandising signals, not as merchant-authored source text.",
      inputSchema: globalGetProductInputSchema
    },
    async ({ meta, catalog }: z.infer<typeof globalGetProductInputSchema>) => {
      const response = await fetch("https://catalog.shopify.com/api/ucp/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 4,
          params: { name: "get_product", arguments: { meta, catalog } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  // --- Storefront Catalog Tools ---
  server.registerTool(
    "get_llms_docs",
    {
      description: "Returns the full documentation for this server as markdown, including all available tools, parameters, curl examples, and response shapes. Call this first to understand what this server can do and how to call its tools.",
      inputSchema: getLlmsDocsInputSchema
    },
    async () => {
      return {
        content: [{ text: storefrontMd, type: "text" }]
      };
    }
  );

  server.registerTool(
    "search_catalog",
    {
      description: "Searches the store's product catalog. The response conforms to the UCP catalog search response, including a UCP metadata envelope; products with title, description, price range (minor units), media, and variants; and cursor-based pagination. Use this when a customer asks for products matching specific criteria or wants to browse items in a category.",
      inputSchema: searchCatalogInputSchema
    },
    async ({ shop_domain, meta, catalog }: z.infer<typeof searchCatalogInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 2,
          params: { name: "search_catalog", arguments: { meta, catalog } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "lookup_catalog",
    {
      description: "Retrieves products or variants by identifier. The response conforms to the UCP catalog lookup response, including products with inputs correlation on each variant and not_found messages for unresolved identifiers. Use this when you have product or variant IDs from search results or deep links, need to resolve multiple identifiers in a single request, or are validating cart items against current catalog data.",
      inputSchema: lookupCatalogInputSchema
    },
    async ({ shop_domain, meta, catalog }: z.infer<typeof lookupCatalogInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 3,
          params: { name: "lookup_catalog", arguments: { meta, catalog } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "get_product",
    {
      description: "Retrieves full details for a single product with optional variant selection. The response conforms to the UCP catalog get_product response, including product.selected reflecting effective option selections, option values with available and exists signals, and variants matching the selection. Use this when a customer has selected a product and needs full details, you need to show variant options with availability signals, or a customer is making option selections (Color, Size, and so on).",
      inputSchema: getProductInputSchema
    },
    async ({ shop_domain, meta, catalog }: z.infer<typeof getProductInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 4,
          params: { name: "get_product", arguments: { meta, catalog } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  // --- Cart Tools ---
  server.registerTool(
    "create_cart",
    {
      description: "Create a new cart with line items and optional buyer context.",
      inputSchema: createCartInputSchema
    },
    async ({ shop_domain, meta, cart }: z.infer<typeof createCartInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: { name: "create_cart", arguments: { meta, cart } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "get_cart",
    {
      description: "Retrieve the current state of an existing cart.",
      inputSchema: getCartInputSchema
    },
    async ({ shop_domain, meta, id }: z.infer<typeof getCartInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: { name: "get_cart", arguments: { meta, id } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "update_cart",
    {
      description: "Replace the contents of an existing cart.",
      inputSchema: updateCartInputSchema
    },
    async ({ shop_domain, meta, id, cart }: z.infer<typeof updateCartInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 2,
          params: { name: "update_cart", arguments: { meta, id, cart } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "cancel_cart",
    {
      description: "Cancel an active cart.",
      inputSchema: cancelCartInputSchema
    },
    async ({ shop_domain, meta, id }: z.infer<typeof cancelCartInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 3,
          params: { name: "cancel_cart", arguments: { meta, id } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  // --- Checkout Tools ---
  server.registerTool(
    "create_checkout",
    {
      description: "Create a new checkout session with line items, buyer information, and fulfillment preferences.",
      inputSchema: createCheckoutInputSchema
    },
    async ({ shop_domain, meta, cart_id, checkout }: z.infer<typeof createCheckoutInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: {
            name: "create_checkout",
            arguments: { meta, ...(cart_id ? { cart_id } : {}), ...(checkout ? { checkout } : {}) }
          }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "get_checkout",
    {
      description: "Retrieve the current state of an existing checkout session.",
      inputSchema: getCheckoutInputSchema
    },
    async ({ shop_domain, meta, id }: z.infer<typeof getCheckoutInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: { name: "get_checkout", arguments: { meta, id } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "update_checkout",
    {
      description: "Update an existing checkout session with new information.",
      inputSchema: updateCheckoutInputSchema
    },
    async ({ shop_domain, meta, id, checkout }: z.infer<typeof updateCheckoutInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: { name: "update_checkout", arguments: { meta, id, checkout } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "complete_checkout",
    {
      description: "Submit payment and place the order.",
      inputSchema: completeCheckoutInputSchema
    },
    async ({ shop_domain, meta, id, checkout }: z.infer<typeof completeCheckoutInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: { name: "complete_checkout", arguments: { meta, id, checkout } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  server.registerTool(
    "cancel_checkout",
    {
      description: "Cancel an active checkout session.",
      inputSchema: cancelCheckoutInputSchema
    },
    async ({ shop_domain, meta, id }: z.infer<typeof cancelCheckoutInputSchema>) => {
      const response = await fetch(`https://${shop_domain}/api/ucp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: { name: "cancel_checkout", arguments: { meta, id } }
        })
      });
      const result = await response.json() as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result, isError: true };
      }
      return { content: [{ text: JSON.stringify(result), type: "text" }], structuredContent: result };
    }
  );

  // --- FAQ & Policies Tools ---
  server.registerTool(
    "search_shop_policies_and_faqs",
    {
      description: "Answers questions about the store's policies, products, and services to build customer trust.",
      inputSchema: searchShopPoliciesAndFaqsInputSchema
    },
    async ({ store_domain, query, context }: z.infer<typeof searchShopPoliciesAndFaqsInputSchema>) => {
      const response = await fetch(`https://${store_domain}/api/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: {
            name: "search_shop_policies_and_faqs",
            arguments: {
              query,
              ...(context ? { context } : {})
            }
          }
        })
      });

      const result = await response.json() as Record<string, unknown>;

      if ("error" in result) {
        return {
          content: [
            {
              text: JSON.stringify(result),
              type: "text"
            }
          ],
          structuredContent: result,
          isError: true
        };
      }

      return {
        content: [
          {
            text: JSON.stringify(result),
            type: "text"
          }
        ],
        structuredContent: result
      };
    }
  );

  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(createServer)(request, env, ctx);
  }
} satisfies ExportedHandler;

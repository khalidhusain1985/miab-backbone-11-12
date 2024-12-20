const crypto = require("crypto");

const webhookSecret = "whsec_4f4xnUlikGraGTrE8RpHYNp5vFsVzPNV"; // Your webhook secret

// Replace the payload below with your JSON data (ensure it's a single-line string)
const payload = JSON.stringify({
  "object": {
    "id": "cs_test_a1lL0pWgHNuBcBoAEHD3ux7VMPJwdzSd6CcsIWvlYXDmVBrYSKiKYjZXkE",
    "object": "checkout.session",
    "adaptive_pricing": {
      "enabled": false
    },
    "after_expiration": null,
    "allow_promotion_codes": null,
    "amount_subtotal": 999,
    "amount_total": 999,
    "automatic_tax": {
      "enabled": false,
      "liability": null,
      "status": null
    },
    "billing_address_collection": null,
    "cancel_url": "https://your-frontend-url.com/cancel",
    "client_reference_id": null,
    "client_secret": null,
    "consent": null,
    "consent_collection": null,
    "created": 1734073265,
    "currency": "usd",
    "currency_conversion": null,
    "custom_fields": [],
    "custom_text": {
      "after_submit": null,
      "shipping_address": null,
      "submit": null,
      "terms_of_service_acceptance": null
    },
    "customer": null,
    "customer_creation": "if_required",
    "customer_details": {
      "address": {
        "city": null,
        "country": "IN",
        "line1": null,
        "line2": null,
        "postal_code": null,
        "state": null
      },
      "email": "sample@example.com",
      "name": "test",
      "phone": null,
      "tax_exempt": "none",
      "tax_ids": []
    },
    "customer_email": "sample@example.com",
    "expires_at": 1734159665,
    "invoice": null,
    "invoice_creation": {
      "enabled": false,
      "invoice_data": {
        "account_tax_ids": null,
        "custom_fields": null,
        "description": null,
        "footer": null,
        "issuer": null,
        "metadata": {},
        "rendering_options": null
      }
    },
    "livemode": false,
    "locale": null,
    "metadata": {},
    "mode": "payment",
    "payment_intent": "pi_3QVSuKHrvHhkYUzE1kL8CpPB",
    "payment_link": null,
    "payment_method_collection": "if_required",
    "payment_method_configuration_details": null,
    "payment_method_options": {
      "card": {
        "request_three_d_secure": "automatic"
      }
    },
    "payment_method_types": [
      "card"
    ],
    "payment_status": "paid",
    "phone_number_collection": {
      "enabled": false
    },
    "recovered_from": null,
    "saved_payment_method_options": null,
    "setup_intent": null,
    "shipping_address_collection": null,
    "shipping_cost": null,
    "shipping_details": null,
    "shipping_options": [],
    "status": "complete",
    "submit_type": null,
    "subscription": null,
    "success_url": "https://your-frontend-url.com/success",
    "total_details": {
      "amount_discount": 0,
      "amount_shipping": 0,
      "amount_tax": 0
    },
    "ui_mode": "hosted",
    "url": null
  },
  "previous_attributes": null
});

const timestamp = Math.floor(Date.now() / 1000);

const signature = crypto
  .createHmac("sha256", webhookSecret)
  .update(`${timestamp}.${payload}`)
  .digest("hex");

console.log(`t=${timestamp},v1=${signature}`);

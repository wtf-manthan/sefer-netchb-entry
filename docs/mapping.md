# Current XML mapping

[VERIFIED — server/src/builder/xml-builder.ts, spec/entry.xsd, spec/data_type.xsd] The following describes implemented output, not every optional XSD element. Both original XSD files remain preserved.

| XML location | Current source/policy | Evidence |
| --- | --- | --- |
| entry/entry-no/system-generated | NetCHB-generated entry number request | VERIFIED — builder; entry.xsd entry-no choice |
| header processing-port, entry-port, entry-date, entry-type | Explicit filing inputs, no shipment defaults | VERIFIED — builder; headerType |
| header importer-tax-id, bond-type, surety-code | Explicit filing inputs; NetCHB bond values 08/09 | VERIFIED — builder; bondType |
| header ultimate-consignee | Explicit consignee name and tax ID; never copied implicitly from importer | VERIFIED — builder; headerType |
| header charges | Sum of resolved USD charges rounded to whole dollars | VERIFIED — builder; headerType xsd:long |
| header gross-weight | Reviewed aggregate or single bill weight, rounded to kg | VERIFIED — resolver and builder; headerType xsd:long |
| header mode-transportation, unlading-port, vessel-name, voyage-no | Resolved mode/port and bill data; length failures are reported rather than truncated silently | VERIFIED — builder; headerType |
| manifest/bill-of-lading | Separate master/house SCACs and bill numbers, package quantity and unit per bill | VERIFIED — builder; manifestType |
| containers/container | Resolved number and available seal per container | VERIFIED — builder; containerType |
| invoices/invoice/invoice-no | Normalize unsupported characters and length, retain original observation and require review; detect collisions | VERIFIED — resolver; data_type.xsd invoiceNoType |
| line-item country-origin, country-export, export-date, lading-port | Separate resolved observation/decision values | VERIFIED — builder; lineItemType |
| line-item manufacturer-id, related-party, invoice-quantity | Resolved MID, explicit related-party choice and selected quantity | VERIFIED — builder; lineItemType |
| tariff tariff-no, value | Selected/extracted code, resolved value in USD | VERIFIED — builder; tariffType |
| tariff quantity1..3, unit-of-measure1..3 | Broker-reviewed statistical quantities; no piece-to-dozen or weight guessing | VERIFIED — builder; tariffType |

[UNKNOWN] Authoritative tariff selection, manufacturer ID construction, port datasets, rounding acceptability for a specific filing, and all specialized filing obligations require further verification. XSD validity establishes XML structure and facets only.

[VERIFIED — builder] No automatic-transmission elements are emitted. Export is a draft for review. Code does not contact NetCHB or CBP.

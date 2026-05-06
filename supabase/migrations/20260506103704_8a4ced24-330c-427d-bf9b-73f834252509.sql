
INSERT INTO finder_api_schema_map (op, field, role, description, example) VALUES
('tracking.byAwb','__input.shipment_id','id_interno','PARAMETRO INPUT obbligatorio: ID interno della spedizione TMWE. NON l''AWB pubblico. Si ottiene da shipment.list filtrando per AWB.','12345'),
('tracking.byAwb','__input.id','id_interno','Alias accettato per shipment_id. Provare entrambi.','12345'),
('tracking.byAwb','__op_purpose','altro','Ritorna eventi/stato di una spedizione TMWE. Richiede ID INTERNO, non AWB. Workflow: shipment.list({awb}) -> id -> tracking.byAwb({shipment_id:id}).',NULL),
('shipment.list','__input.awb','tracking_code','PARAMETRO INPUT facoltativo: filtra per AWB/numero pubblico. Restituisce le spedizioni che lo contengono (di solito 0 o 1).','9352100542'),
('shipment.list','__input.tracking_code','tracking_code','Alias di awb. Provare entrambi.','9352100542'),
('shipment.list','__input.search','altro','Ricerca testuale generica (AWB, RIF cliente, note).','9352100542')
ON CONFLICT DO NOTHING;

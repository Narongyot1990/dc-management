interface YardAssetIdentity {
  type: string;
  container_no?: string | null;
  chassis_plate: string;
}

export function normalizeYardAssetId(value?: string | null) {
  return value?.trim().toUpperCase() ?? '';
}

export function findYardAssetConflict<T extends YardAssetIdentity>(asset: YardAssetIdentity, records: T[]) {
  const container = asset.type === 'chassis' ? '' : normalizeYardAssetId(asset.container_no);
  const plate = normalizeYardAssetId(asset.chassis_plate);
  const sameContainer = container && records.find(record =>
    record.type !== 'chassis' && normalizeYardAssetId(record.container_no) === container
  );
  if (sameContainer) return { record: sameContainer, key: 'container' } as const;
  const samePlate = plate && records.find(record => normalizeYardAssetId(record.chassis_plate) === plate);
  if (samePlate) return { record: samePlate, key: 'plate' } as const;
  return null;
}

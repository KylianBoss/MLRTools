/**
 * DataSource Mapping for AI Alarm Search
 * 
 * This file maps common terms used in intervention descriptions
 * to their corresponding dataSource identifiers in the system.
 * 
 * Used by the AI to better understand which alarms are relevant
 * when users mention machine names, zones, or process areas.
 */

export const DATASOURCE_MAPPING = {
  // Depalletization / Unloading
  'depalettisation': ['X001', 'X002', 'X003'],
  'depal': ['X001', 'X002', 'X003'],
  'dépal': ['X001', 'X002', 'X003'],
  'dépalettisation': ['X001', 'X002', 'X003'],
  'depalletizer': ['X001', 'X002', 'X003'],
  
  // Palletizazion
  'pal': ['X101', 'X102', 'X103', 'X104'],
  'paletisation': ['X101', 'X102', 'X103', 'X104'],
  'paletiser': ['X101', 'X102', 'X103', 'X104'],
  'stacker': ['X101', 'X102', 'X103', 'X104'],
  
  // Convoyeurs
  'convoyeur': ['F001', 'F002', 'F003', 'F004', 'F005', 'F006', 'F007', 'F008', 'F009', 'F010', 'F011', 'F012', 'F013'],
  'convoyeurs': ['F001', 'F002', 'F003', 'F004', 'F005', 'F006', 'F007', 'F008', 'F009', 'F010', 'F011', 'F012', 'F013'],
  'conveyor': ['F001', 'F002', 'F003', 'F004', 'F005', 'F006', 'F007', 'F008', 'F009', 'F010', 'F011', 'F012', 'F013'],
  'conveyors': ['F001', 'F002', 'F003', 'F004', 'F005', 'F006', 'F007', 'F008', 'F009', 'F010', 'F011', 'F012', 'F013'],
  'boucle': ['F002', 'F003', 'F004'],
  'loop': ['F002', 'F003', 'F004'],
  'entrée': ['F001', 'F002', 'F003'],
  'sortie': ['F013'],
  'tray': ['F011']
  
  // Add more mappings as needed
  // Example:
  // 'conveyor': ['X011', 'X012'],
  // 'robot': ['X013', 'X014'],
};

/**
 * Get all dataSources for a given keyword
 * @param {string} keyword - The term to search for
 * @returns {string[]} Array of dataSource IDs
 */
export function getDataSourcesForKeyword(keyword) {
  const normalizedKeyword = keyword.toLowerCase().trim();
  return DATASOURCE_MAPPING[normalizedKeyword] || [];
}

/**
 * Generate a formatted string for AI prompt
 * @returns {string} Formatted mapping for AI context
 */
export function generateDataSourceMappingPrompt() {
  const lines = [];
  
  lines.push('DATASOURCE MAPPING (users often reference these terms):');
  
  // Group by dataSources
  const grouped = {};
  for (const [keyword, sources] of Object.entries(DATASOURCE_MAPPING)) {
    const key = sources.join(',');
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(keyword);
  }
  
  // Format output
  for (const [sources, keywords] of Object.entries(grouped)) {
    const keywordList = keywords.map(k => `"${k}"`).join(', ');
    lines.push(`- ${keywordList} → ${sources.replace(',', ', ')}`);
  }
  
  return lines.join('\n');
}

/**
 * Search intervention description for known keywords
 * @param {string} description - Intervention description
 * @returns {string[]} Array of matched dataSource IDs
 */
export function extractDataSourcesFromDescription(description) {
  const normalized = description.toLowerCase();
  const matchedSources = new Set();
  
  for (const [keyword, sources] of Object.entries(DATASOURCE_MAPPING)) {
    if (normalized.includes(keyword)) {
      sources.forEach(source => matchedSources.add(source));
    }
  }
  
  return Array.from(matchedSources);
}

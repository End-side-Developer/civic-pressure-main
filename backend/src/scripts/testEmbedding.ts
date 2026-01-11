/**
 * Test Script for Embedding Service
 * 
 * Run with: npx ts-node src/scripts/testEmbedding.ts
 * 
 * This script tests the embedding service with various complaint scenarios
 * to verify that semantic similarity and location-based matching work correctly.
 */

import { 
  loadModel, 
  testSimilarity, 
  createEmbeddingText,
  normalizeText,
  EMBEDDING_CONFIG 
} from '../services/embeddingService';

// Test cases for embedding similarity
const testCases = [
  {
    name: 'TEST 1: Exact Duplicate (Same title, category, description, location)',
    complaint1: {
      title: 'Pothole on Main Street causing accidents',
      category: 'INFRASTRUCTURE',
      description: 'There is a large pothole on Main Street near the market. It is causing accidents and damage to vehicles. Please fix it urgently.',
      location: 'Main Street, Near Market',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    complaint2: {
      title: 'Pothole on Main Street causing accidents',
      category: 'INFRASTRUCTURE',
      description: 'There is a large pothole on Main Street near the market. It is causing accidents and damage to vehicles. Please fix it urgently.',
      location: 'Main Street, Near Market',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    expectedDuplicate: true,
    expectedSimilarityMin: 0.99,
  },
  {
    name: 'TEST 2: Similar Issue, Same Location (Should be duplicate)',
    complaint1: {
      title: 'Road pothole causing vehicle damage',
      category: 'INFRASTRUCTURE',
      description: 'Big pothole on the main road is damaging cars and motorcycles. Very dangerous for traffic.',
      location: 'Main Street, Downtown',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    complaint2: {
      title: 'Dangerous pothole needs repair',
      category: 'INFRASTRUCTURE',
      description: 'There is a huge pothole that is causing damage to vehicles. Many accidents have happened.',
      location: 'Main Street, City Center',
      coordinates: { latitude: 25.2050, longitude: 55.2710 }, // ~50m away
    },
    expectedDuplicate: true,
    expectedSimilarityMin: 0.80,
  },
  {
    name: 'TEST 3: Same Issue, Different Location (500m+ apart - NOT duplicate)',
    complaint1: {
      title: 'Street light not working',
      category: 'UTILITIES',
      description: 'The street light near my house has not been working for a week. It is very dark at night.',
      location: 'Block A, Residential Area',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    complaint2: {
      title: 'Street light not working',
      category: 'UTILITIES',
      description: 'The street light near my house has not been working for a week. It is very dark at night.',
      location: 'Block Z, Industrial Area',
      coordinates: { latitude: 25.2100, longitude: 55.2780 }, // ~1km away
    },
    expectedDuplicate: false, // Different locations = NOT duplicate even if text is same
    expectedSimilarityMin: 0.90,
  },
  {
    name: 'TEST 4: Different Issue, Same Category (NOT duplicate)',
    complaint1: {
      title: 'Water supply interrupted',
      category: 'UTILITIES',
      description: 'No water supply in our area since morning. Please restore water supply immediately.',
      location: 'Building 5, Garden Complex',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    complaint2: {
      title: 'Electricity fluctuation problem',
      category: 'UTILITIES',
      description: 'Voltage fluctuation is damaging our appliances. Need stable power supply.',
      location: 'Building 5, Garden Complex',
      coordinates: { latitude: 25.2049, longitude: 55.2709 }, // Same building
    },
    expectedDuplicate: false,
    expectedSimilarityMin: 0.40,
  },
  {
    name: 'TEST 5: Similar Issue with Synonyms (Should match)',
    complaint1: {
      title: 'Garbage not collected for days',
      category: 'SANITATION',
      description: 'Garbage is piling up in our street. Nobody has come to collect it for 5 days.',
      location: 'Street 10, Block C',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    complaint2: {
      title: 'Waste not picked up causing smell',
      category: 'SANITATION',
      description: 'Trash has been accumulating and causing bad smell. Sanitation workers have not visited.',
      location: 'Street 10, Area C',
      coordinates: { latitude: 25.2050, longitude: 55.2710 }, // Very close
    },
    expectedDuplicate: true,
    expectedSimilarityMin: 0.75,
  },
  {
    name: 'TEST 6: Different Category (NOT duplicate)',
    complaint1: {
      title: 'Road condition is poor',
      category: 'INFRASTRUCTURE',
      description: 'The road in our area is in very bad condition with many potholes.',
      location: 'Main Road, Sector 5',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    complaint2: {
      title: 'Road safety issue',
      category: 'PUBLIC SAFETY',
      description: 'The road in our area needs traffic signals. Many accidents happening.',
      location: 'Main Road, Sector 5',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    expectedDuplicate: false, // Different categories
    expectedSimilarityMin: 0.50,
  },
  {
    name: 'TEST 7: Completely Different Complaints',
    complaint1: {
      title: 'Stray dogs menace in park',
      category: 'ANIMAL WELFARE',
      description: 'Pack of stray dogs in the community park are scaring children and elderly people.',
      location: 'Community Park, Green Valley',
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
    },
    complaint2: {
      title: 'School building needs repair',
      category: 'EDUCATION',
      description: 'The roof of the government school is leaking during rain. Classrooms are getting damaged.',
      location: 'Government School, Hill View',
      coordinates: { latitude: 25.3000, longitude: 55.3500 }, // Far away
    },
    expectedDuplicate: false,
    expectedSimilarityMin: 0.20,
  },
  {
    name: 'TEST 8: Same Issue, No Coordinates (Location text only)',
    complaint1: {
      title: 'Traffic congestion during peak hours',
      category: 'TRAFFIC',
      description: 'Heavy traffic congestion every morning and evening. Need traffic management.',
      location: 'Junction 5, Industrial Area',
    },
    complaint2: {
      title: 'Traffic jam causing delays',
      category: 'TRAFFIC',
      description: 'Severe traffic jam at the main junction. People are getting late to work.',
      location: 'Junction 5, Factory Zone',
    },
    expectedDuplicate: true, // Should match based on text alone
    expectedSimilarityMin: 0.80,
  },
];

async function runTests() {
  console.log('========================================');
  console.log('EMBEDDING SERVICE TEST SUITE');
  console.log('========================================\n');
  
  console.log('Loading embedding model...');
  await loadModel();
  console.log('Model loaded successfully!\n');
  
  console.log('Configuration:');
  console.log(`  - Default Threshold: ${EMBEDDING_CONFIG.defaultThreshold}`);
  console.log(`  - Semantic Weight: ${EMBEDDING_CONFIG.semanticWeight}`);
  console.log(`  - Location Weight: ${EMBEDDING_CONFIG.locationWeight}`);
  console.log(`  - Hard Distance Cutoff: ${EMBEDDING_CONFIG.hardDistanceCutoffKm * 1000}m`);
  console.log('\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log('----------------------------------------');
    console.log(testCase.name);
    console.log('----------------------------------------');
    
    try {
      const result = await testSimilarity(testCase.complaint1, testCase.complaint2);
      
      console.log('\nComplaint 1:');
      console.log(`  Title: ${testCase.complaint1.title}`);
      console.log(`  Category: ${testCase.complaint1.category}`);
      console.log(`  Location: ${testCase.complaint1.location || 'N/A'}`);
      
      console.log('\nComplaint 2:');
      console.log(`  Title: ${testCase.complaint2.title}`);
      console.log(`  Category: ${testCase.complaint2.category}`);
      console.log(`  Location: ${testCase.complaint2.location || 'N/A'}`);
      
      console.log('\nResults:');
      console.log(`  Semantic Similarity: ${(result.semanticSimilarity * 100).toFixed(2)}%`);
      if (result.distanceKm !== null) {
        console.log(`  Distance: ${(result.distanceKm * 1000).toFixed(0)}m`);
        console.log(`  Location Score: ${(result.locationScore! * 100).toFixed(2)}%`);
        console.log(`  Within Range (≤500m): ${result.breakdown.locationWithinRange ? 'YES' : 'NO'}`);
      }
      console.log(`  Combined Score: ${(result.combinedScore * 100).toFixed(2)}%`);
      console.log(`  Would Be Duplicate: ${result.wouldBeDuplicate ? 'YES' : 'NO'}`);
      
      console.log('\nBreakdown:');
      console.log(`  Title Match: ${result.breakdown.titleMatch}`);
      console.log(`  Category Match: ${result.breakdown.categoryMatch ? 'YES' : 'NO'}`);
      console.log(`  Description Overlap: ${result.breakdown.descriptionOverlap}`);
      
      // Verify expectations
      const duplicateMatch = result.wouldBeDuplicate === testCase.expectedDuplicate;
      const similarityMatch = result.semanticSimilarity >= testCase.expectedSimilarityMin;
      
      console.log('\nExpectations:');
      console.log(`  Expected Duplicate: ${testCase.expectedDuplicate ? 'YES' : 'NO'} ${duplicateMatch ? '✅' : '❌'}`);
      console.log(`  Min Similarity: ${(testCase.expectedSimilarityMin * 100).toFixed(0)}% ${similarityMatch ? '✅' : '❌'}`);
      
      if (duplicateMatch && similarityMatch) {
        console.log('\n✅ TEST PASSED');
        passed++;
      } else {
        console.log('\n❌ TEST FAILED');
        failed++;
      }
      
    } catch (error) {
      console.error('Error running test:', error);
      failed++;
    }
    
    console.log('\n');
  }
  
  console.log('========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Pass Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
  console.log('========================================\n');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);

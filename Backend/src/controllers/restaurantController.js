const Restaurant = require("../models/Restaurant");
const Review = require("../models/Review");
const { buildAssistantMessage } = require("../services/assistantService");
const { predictSentiment } = require("../services/sentimentService");
const { syncRestaurantReviewMetrics } = require("../utils/reviewMetrics");
const {
  normalizePriceRange,
  getPriceRangeAliases,
  getPriceRangeLevel,
} = require("../utils/priceRange");

const locationCenters = {
  Ahangama: { lat: 5.973, lng: 80.358 },
  Galle: { lat: 6.0535, lng: 80.221 },
  "Galle Fort": { lat: 6.026, lng: 80.217 },
  Unawatuna: { lat: 6.0108, lng: 80.249 },
  Weligama: { lat: 5.975, lng: 80.429 },
  Mirissa: { lat: 5.946, lng: 80.458 },
  Tangalle: { lat: 6.024, lng: 80.797 },
};

let seedInitialized = false;
const legacyRestaurantIds = [
  "amma-home-kitchen",
  "Hasara-Hotel",
  "HasaraGalle",
  "black-honey-ahangama",
  "pedlars-inn-cafe",
  "isle-coffee-lab",
  "fort-bake-house",
  "reef-edge-bistro",
];
const geocodeCache = new Map();
const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "near",
  "best",
  "food",
  "place",
  "restaurant",
  "in",
  "at",
  "to",
  "a",
  "an",
]);
const positiveLexicon = new Set([
  "amazing",
  "awesome",
  "best",
  "clean",
  "cozy",
  "delicious",
  "excellent",
  "friendly",
  "fresh",
  "good",
  "great",
  "nice",
  "perfect",
  "quick",
  "recommended",
  "tasty",
  "wonderful",
]);

const negativeLexicon = new Set([
  "awful",
  "bad",
  "bland",
  "cold",
  "dirty",
  "disappointing",
  "expensive",
  "late",
  "noisy",
  "overpriced",
  "poor",
  "rude",
  "slow",
  "terrible",
  "worst",
]);

const topicLexicon = {
  food: ["food", "dish", "meal", "taste", "flavor", "portion", "menu"],
  service: ["service", "staff", "waiter", "waitress", "host", "attitude", "support"],
  price: ["price", "cost", "value", "expensive", "cheap", "overpriced", "budget"],
  ambience: ["ambience", "atmosphere", "music", "crowd", "view", "vibe", "decor"],
};
const sampleRestaurants = [
  {
    id: "kai-ahangama",
    name: "Kai Ahangama",
    location: "Ahangama",
    rating: 0,
    reviews: 0,
    price: "Moderate",
    rankingScore: 0,
    image: "",
    desc: "Beautiful seaside restaurant with fresh seafood, cocktails, and golden sunset views by the ocean.",
    hours: "8 AM - 11 PM",
    vibe: "Beachy | Sunset | Trending",
    bestTime: "5:30 PM - 6:30 PM (Golden Hour)",
    goodFor: ["Couples", "Sunset Views", "Instagram", "Drinks"],
    address: " 62 Galle Rd, Ahangama",
    nearby: ["Crust Ahangama - 200m", "Mashmello Cafe - 350m"],
    budget: [
      { name: "Iced Americano", price: "Rs. 900" },
      { name: "Latte", price: "Rs. 1000" },
      { name: "Iced Milo", price: "Rs. 900" },
      { name: "Watermelon Juice", price: "Rs. 1200" },
    ],
    premium: [
      { name: "Croissant Benny", price: "Rs2,900.00" },
      { name: "Beef Bolognese", price: "Rs.3,500.00" },
      { name: "Fresh From The Sea", price: "Rs.2,700.00" },
      { name: "Tuna Poke Bowl", price: "Rs.3,400.00" },
    ],
    dietaryTags: ["Seafood", "Gluten-free options", "Vegetarian options"],
    menuCategories: {
      breakfast: [
        { name: "Croissant Benny", price: "Rs2,900.00" },
        { name: "Brioche French Toast", price: "Rs.2,800.00" },
        { name: "Classic French Toast", price: "Rs.2,400.00" },
        { name: "Island Caesar Salad", price: "Rs.2,800.00" },
        { name: "Pulled Bbq Jackfruit Tacos", price: "Rs.2,900.00" },
      ],
      main: [
        { name: "Grilled Tuna Steak", price: "Rs. 3,200" },
        { name: "Beef Bolognese", price: "Rs.3,500.00" },
        { name: "Tuna Poke Bowl", price: "Rs.3,400.00" },
        { name: "Fresh From The Sea", price: "Rs.2,700.00" },
      ],
      drinks: [
        { name: "Coconut Sour", price: "Rs. 2000" },
        { name: "Espresso Martini", price: "Rs. 2,500" },
        { name: "Passion & Pomegranate", price: "Rs. 2,500" },
        { name: "Watermelon Sugar Hiiii", price: "Rs. 2,500" },
      ],
    },
    reviewsPreview: [
      "Amazing sunset views and cocktails",
      "Great seafood, bit pricey but worth it",
      "Perfect date spot by the beach",
    ],
    mapQuery: "Kai Ahangama Sri Lanka",
    coordinates: { lat: 5.9724, lng: 80.3568 },
  },
  {
    id: "crust-ahangama",
    name: "Crust Ahangama",
    location: "Ahangama",
    rating: 0,
    reviews: 0,
    price: "Moderate",
    rankingScore: 0,
    image: "",
    desc: "Wood-fired pizza, chill surf-town vibes and great cocktails near the beach.",
    hours: "11 AM - 11 PM",
    vibe: "Pizza | Surf | Cocktails",
    bestTime: "7 PM - 9 PM",
    goodFor: ["Friends", "Pizza", "Drinks"],
    address: "Main St, Ahangama",
    nearby: ["Cafe Chill - 180m", "Sunset Point - 400m"],
    budget: [
      { name: "Margherita Slice", price: "Rs. 1,100" },
      { name: "Garlic Bread", price: "Rs. 700" },
      { name: "Iced Tea", price: "Rs. 350" },
    ],
    premium: [
      { name: "Seafood Pizza", price: "Rs. 3,800" },
      { name: "Wood-fired Steak", price: "Rs. 4,900" },
      { name: "Craft Cocktail", price: "Rs. 1,500" },
    ],
    dietaryTags: ["Vegetarian options", "Halal-friendly options"],
    menuCategories: {
      breakfast: [
        { name: "Breakfast Pizza Slice", price: "Rs. 1,250" },
        { name: "Garlic Bread", price: "Rs. 700" },
      ],
      main: [
        { name: "Seafood Pizza", price: "Rs. 3,800" },
        { name: "Margherita Slice", price: "Rs. 1,100" },
        { name: "Wood-fired Steak", price: "Rs. 4,900" },
      ],
      drinks: [
        { name: "Iced Tea", price: "Rs. 350" },
        { name: "Craft Cocktail", price: "Rs. 1,500" },
      ],
    },
    reviewsPreview: ["Best pizza in Ahangama", "Cool surf-town vibe"],
    mapQuery: "Crust Ahangama Sri Lanka",
    coordinates: { lat: 5.9727, lng: 80.3604 },
  },
  {
    id: "cactus-ahangama",
    name: "Cactus Ahangama",
    location: "Ahangama",
    rating: 0,
    reviews: 0,
    price: "Moderate",
    rankingScore: 0,
    image: "",
    desc: "Bright brunch spot with big breakfasts, bowls, fresh juices, and cocktails in a laid-back surf-town setting.",
    hours: "8 AM - 4 PM",
    vibe: "Brunch | Healthy | Coffee",
    bestTime: "9 AM - 12 PM",
    goodFor: ["Brunch", "Healthy bowls", "Coffee", "Friends"],
    address: "Ahangama, Sri Lanka",
    nearby: ["Crust Ahangama - 350m", "Ahangama Beach - 700m"],
    dietaryTags: ["Vegetarian options", "Vegan options", "Gluten-free options"],
    menuCategories: {
      breakfast: [
        { name: "Big Brekky Spread", price: "Rs. 3,000.00" },
        { name: "Wakey Wakey Bagel", price: "Rs. 2,500.00" },
        { name: "Avo & Eggs", price: "Rs. 2,500.00" },
        { name: "Lankan Benny", price: "Rs. 2,400.00" },
        { name: "Cheesy Grilled Panini", price: "Rs. 2,600.00" },
        { name: "Probiotic Dream", price: "Rs. 2,600.00" },
        { name: "Fluffy Pancakes", price: "Rs. 2,700.00" },
        { name: "Rhubarb Frenchy", price: "Rs. 2,500.00" },
      ],
      main: [
        { name: "Fried Chicken Frenchy", price: "Rs. 3,000.00" },
        { name: "Vegano Delight", price: "Rs. 2,600.00" },
        { name: "The Fisho", price: "Rs. 3,300.00" },
        { name: "Power Me Up", price: "Rs. 2,900.00" },
        { name: "Greek Bowling", price: "Rs. 2,900.00" },
        { name: "Fiesta Shrimp Bowl", price: "Rs. 3,100.00" },
        { name: "Ciao Focaccia (Vegetariano)", price: "Rs. 2,700.00" },
        { name: "Ciao Focaccia (With Chicken)", price: "Rs. 3,000.00" },
      ],
      drinks: [
        { name: "Fuel Have (Smoothie)", price: "Rs. 1,600.00" },
        { name: "Inflammation Fighter (Smoothie)", price: "Rs. 1,600.00" },
        { name: "Green C (Smoothie)", price: "Rs. 1,600.00" },
        { name: "Immune Booster (Cold-pressed juice)", price: "Rs. 1,400.00" },
        { name: "Tamarind Soda", price: "Rs. 1,100.00" },
        { name: "Mimosa", price: "Rs. 2,200.00" },
        { name: "Espresso", price: "Rs. 600.00" },
        { name: "Iced Latte", price: "Rs. 1,200.00" },
        { name: "Matcha Latte", price: "Rs. 1,550.00" },
      ],
    },
    reviewsPreview: ["Huge brunch menu", "Great coffee and bowls", "Perfect mid-morning stop"],
    mapQuery: "Cactus Ahangama Sri Lanka",
    coordinates: { lat: 5.9733, lng: 80.3589 },
  },
  {
    id: "sahana-urban",
    name: "Sahana Urban",
    location: "Galle Fort",
    rating: 0,
    reviews: 0,
    price: "Budget",
    rankingScore: 0,
    image: "",
    desc: "Cozy cafe inside Galle Fort with chill vibes, brunch plates and good coffee.",
    hours: "9 AM - 9 PM",
    vibe: "Cafe | Heritage | Chill",
    bestTime: "9 AM - 11 AM",
    goodFor: ["Brunch", "Work-friendly", "Coffee"],
    address: "Church St, Galle Fort",
    nearby: ["Pedlar's Inn - 200m", "Coconut Cafe - 300m"],
    budget: [
      { name: "Veg Spring Rolls", price: "Rs. 350.00" },
      { name: "Americano", price: "Rs. 700.00" },
      { name: "Sticky BBQ Chicken Wings", price: "Rs. 1,020.00" },
      { name: "Chicken Popcorn Rice", price: "Rs. 1,050.00" },
    ],
    premium: [
      { name: "Nasi Goreng Seafood", price: "Rs. 1,450.00" },
      { name: "Grilled Lamb Chops With Mint Sauce", price: "Rs. 3,400.00" },
      { name: "Special Sizzling Mixed Grilled Platter", price: "Rs. 3,650.00" },
      { name: "Seafood Pizza", price: "Rs. 1,930.00" },
    ],
    dietaryTags: ["Vegan options", "Vegetarian options", "Gluten-free options"],
    menuCategories: {
      breakfast: [
        { name: "Veg Spring Rolls", price: "Rs. 350.00" },
        { name: "Sweet Corn Egg Drop Soup", price: "Rs. 410.00" },
        { name: "Sticky BBQ Chicken Wings", price: "Rs. 1,020.00" },
      ],
      main: [
        { name: "Chicken Popcorn Rice", price: "Rs. 1,050.00" },
        { name: "Spicy Seafood Kottu", price: "Rs. 950.00" },
        { name: "Nasi Goreng Seafood", price: "Rs. 1,450.00" },
        { name: "Grilled Lamb Chops With Mint Sauce", price: "Rs. 3,400.00" },
        { name: "Special Sizzling Mixed Grilled Platter", price: "Rs. 3,650.00" },
      ],
      drinks: [
        { name: "Americano", price: "Rs. 700.00" },
        { name: "Cafe Mocha", price: "Rs. 1,130.00" },
      ],
    },
    reviewsPreview: ["Cute cozy cafe", "Great coffee inside the fort"],
    mapQuery: "Sahana Urban Galle Fort",
    coordinates: { lat: 6.0254, lng: 80.2168 },
  },
  {
    id: "fortheritagecabin",
    name: "Fort Heritage Food Cabin",
    location: "Galle Fort",
    rating: 0,
    reviews: 0,
    price: "Budget",
    rankingScore: 0,
    image: "",
    desc: "Budget Friendly and Delicious Food",
    hours: "4:30 PM - 8:30 PM",
    vibe: "Street Food | Family | Casual",
    bestTime: "5:00 PM - 7:00 PM",
    goodFor: ["Dinner", "Friends"],
    address: "Rampart St, Galle",
    nearby: ["Indian Hut - 200m"],
    budget: [{ name: "Fried Rice", price: "Rs. 1200" }],
    premium: [{ name: "Seafood Platter", price: "Rs. 3500" }],
    dietaryTags: ["Vegetarian options"],
    menuCategories: {
      breakfast: [],
      main: [{ name: "Fried Rice", price: "Rs. 1200" }],
      drinks: [{ name: "Fresh Juice", price: "Rs. 500" }],
    },
    reviewsPreview: ["Nice place", "Good food", "Budget Friendly"],
    mapQuery: "26H8+52R, Rampart St, Galle, Sri Lanka",
    coordinates: { lat: 6.02799, lng: 80.21501 },
  },
  {
    id: "orange-kitchen",
    name: "Orange Kitchen Galle",
    location: "Galle",
    rating: 0,
    reviews: 0,
    price: "Moderate",
    rankingScore: 0,
    image: "",
    desc: "Relaxed dinner spot with outdoor seating and comfort food.",
    hours: "12 PM - 10 PM",
    vibe: "Comfort | Outdoor | Relaxed",
    bestTime: "6 PM - 8 PM",
    goodFor: ["Outdoor Seating", "Family", "Comfort"],
    address: "Galle Road, Galle",
    nearby: ["Dutch Lanka - 250m", "Cafe Mango - 400m"],
    budget: [
      { name: "Chicken Fried Rice", price: "Rs. 1,200" },
      { name: "Veg Noodles", price: "Rs. 950" },
      { name: "Fresh Lime", price: "Rs. 300" },
    ],
    premium: [
      { name: "BBQ Ribs", price: "Rs. 3,900" },
      { name: "Seafood Mix Grill", price: "Rs. 4,600" },
      { name: "Signature Mocktail", price: "Rs. 1,100" },
    ],
    dietaryTags: ["Halal-friendly options", "Vegetarian options"],
    menuCategories: {
      breakfast: [
        { name: "Fresh Lime", price: "Rs. 300" },
        { name: "Veg Noodles", price: "Rs. 950" },
      ],
      main: [
        { name: "Chicken Fried Rice", price: "Rs. 1,200" },
        { name: "BBQ Ribs", price: "Rs. 3,900" },
        { name: "Seafood Mix Grill", price: "Rs. 4,600" },
      ],
      drinks: [
        { name: "Fresh Lime", price: "Rs. 300" },
        { name: "Signature Mocktail", price: "Rs. 1,100" },
      ],
    },
    reviewsPreview: ["Great outdoor vibe", "Perfect family dinner"],
    mapQuery: "Orange Kitchen Galle Sri Lanka",
    coordinates: { lat: 6.0376, lng: 80.2188 },
  },
  {
    id: "sahanabeach",
    name: "Sahana Beach",
    location: "Galle",
    rating: 0,
    reviews: 0,
    price: "Budget",
    rankingScore: 0,
    image: "",
    desc: "Budget Friendly, Delicious Food and Sea View Restaurant and Bakery",
    hours: "6:00 AM - 12:00 AM",
    vibe: "Street Food | Sea view | Casual",
    bestTime: "5:00 PM - 10:00 PM",
    goodFor: ["Dinner", "Friends", "Lunch", "Short Eats"],
    address: "438 Matara Rd",
    nearby: ["Madeena - 200m"],
    budget: [{ name: "Fried Rice", price: "Rs. 1200" }],
    premium: [{ name: "Seafood Platter", price: "Rs. 3500" }],
    dietaryTags: ["Vegetarian options"],
    menuCategories: {
      breakfast: [],
      main: [{ name: "Fried Rice", price: "Rs. 1200" }],
      drinks: [{ name: "Fresh Juice", price: "Rs. 500" }],
    },
    reviewsPreview: ["Nice place", "Good food", "Budget Friendly"],
    mapQuery: "Sahana Beach, Megalle, Galle, Sri Lanka",
    coordinates: { lat: 6.03327, lng: 80.23552 },
  },
  {
    id: "dutch-lanka",
    name: "Dutch Lanka Restaurant & Bakery",
    location: "Galle",
    rating: 0,
    reviews: 0,
    price: "Budget",
    rankingScore: 0,
    image: "",
    desc: "Bakery meets Sri Lankan food with fresh pastries and rice & curry.",
    hours: "8 AM - 8 PM",
    vibe: "Bakery | Local | Cozy",
    bestTime: "8 AM - 10 AM",
    goodFor: ["Breakfast", "Family", "Pastries"],
    address: "Fort Rd, Galle",
    nearby: ["Orange Kitchen - 250m", "Pedlar's Inn - 450m"],
    budget: [
      { name: "Vegetable Roti", price: "Rs. 200" },
      { name: "Fish Bun", price: "Rs. 180" },
      { name: "Tea", price: "Rs. 120" },
    ],
    premium: [
      { name: "Seafood Rice & Curry", price: "Rs. 1,800" },
      { name: "Bakery Platter", price: "Rs. 1,500" },
      { name: "Fresh Juice Combo", price: "Rs. 900" },
    ],
    dietaryTags: ["Vegetarian options", "Halal-friendly options", "Bakery specials"],
    menuCategories: {
      breakfast: [
        { name: "Vegetable Roti", price: "Rs. 200" },
        { name: "Fish Bun", price: "Rs. 180" },
      ],
      main: [
        { name: "Seafood Rice & Curry", price: "Rs. 1,800" },
        { name: "Bakery Platter", price: "Rs. 1,500" },
      ],
      drinks: [
        { name: "Tea", price: "Rs. 120" },
        { name: "Fresh Juice Combo", price: "Rs. 900" },
      ],
    },
    reviewsPreview: ["Great bakery treats", "Cozy local vibe"],
    mapQuery: "Dutch Lanka Restaurant & Bakery Galle Sri Lanka",
    coordinates: { lat: 6.03, lng: 80.2162 },
  },
  {
    id: "hasarahotel",
    name: "Hasara Hotel",
    location: "Galle",
    rating: 0,
    reviews: 0,
    price: "Budget",
    rankingScore: 0,
    image: "",
    desc: "Small family-run restaurant serving affordable Sri Lankan rice and curry with warm home-style service.",
    hours: "7 AM - 8 PM",
    vibe: "Family-run | Local | Budget-friendly",
    bestTime: "12 PM - 2 PM",
    goodFor: ["Budget Meals", "Local Food", "Families", "Takeaway"],
    address: "Wakwella Road, Galle",
    nearby: ["Galle Bus Stand - 500m", "Dutch Hospital - 1.2km"],
    budget: [
      { name: "Rice & 3 Curries", price: "Rs. 450" },
      { name: "String Hoppers Set", price: "Rs. 300" },
      { name: "Plain Tea", price: "Rs. 100" },
    ],
    premium: [
      { name: "Chicken Rice & Curry", price: "Rs. 850" },
      { name: "Fish Ambul Thiyal Meal", price: "Rs. 950" },
      { name: "Fresh Fruit Juice", price: "Rs. 450" },
    ],
    dietaryTags: ["Vegetarian options", "Local Sri Lankan", "Halal-friendly options"],
    menuCategories: {
      breakfast: [
        { name: "String Hoppers Set", price: "Rs. 300" },
        { name: "Plain Tea", price: "Rs. 100" },
      ],
      main: [
        { name: "Rice & 3 Curries", price: "Rs. 350" },
        { name: "Chicken Rice & Curry", price: "Rs. 450" },
        { name: "Fish Ambul Thiyal Meal", price: "Rs. 950" },
      ],
      drinks: [
        { name: "Plain Tea", price: "Rs. 100" },
        { name: "Fresh Fruit Juice", price: "Rs. 450" },
      ],
    },
    reviewsPreview: ["Very friendly owner and tasty curries", "Best value lunch in Galle"],
    mapQuery: "hasarahotel Galle Sri Lanka",
    coordinates: { lat: 6.0412, lng: 80.2216 },
  },
  {
    id: "akeera-watalappan",
    name: "Akeera watalappan",
    location: "Galle",
    rating: 0,
    reviews: 0,
    price: "Budget",
    rankingScore: 0,
    image: "",
    desc: "Family-owned small dessert business known for homemade watalappan and sweet cups.",
    hours: "10 AM - 8 PM",
    vibe: "Family-owned | Dessert | Homemade",
    bestTime: "4 PM - 7 PM",
    goodFor: ["Desserts", "Takeaway", "Affordable Treats"],
    address: "Galle",
    nearby: ["Galle Town Area"],
    budget: [
      { name: "Watalappan (Small)", price: "Rs. 300" },
      { name: "Brownie Cup", price: "Rs. 300" },
      { name: "Falooda", price: "Rs. 350" },
    ],
    premium: [
      { name: "Watalappan (Medium)", price: "Rs. 500" },
      { name: "Watalappan (Large)", price: "Rs. 900" },
      { name: "Falooda", price: "Rs. 350" },
    ],
    dietaryTags: ["Homemade Desserts", "Family-owned"],
    menuCategories: {
      breakfast: [
        { name: "Watalappan (Small)", price: "Rs. 300" },
        { name: "Brownie Cup", price: "Rs. 300" },
      ],
      main: [
        { name: "Watalappan (Medium)", price: "Rs. 500" },
        { name: "Watalappan (Large)", price: "Rs. 900" },
      ],
      drinks: [
        { name: "Falooda", price: "Rs. 350" },
      ],
    },
    reviewsPreview: ["Best watalappan in town", "Fresh and very tasty desserts"],
    mapQuery: "Akeera watalappan Galle Sri Lanka",
    coordinates: { lat: 6.0535, lng: 80.221 },
  },
  {
    id: "double-barrel",
    name: "Double Barrel Restaurant",
    location: "Galle",
    rating: 0,
    reviews: 0,
    price: "Moderate",
    rankingScore: 0,
    image: "",
    desc: "Rustic grill and Sri Lankan fusion spot with an enormous menu covering grills, kottu, noodles, and mocktails.",
    hours: "11 AM - 11 PM",
    vibe: "Grill | Family | Live Music",
    bestTime: "6 PM - 9 PM",
    goodFor: ["Families", "Large Groups", "Late-night bites"],
    address: "Matara Rd, Galle",
    nearby: ["Dutch Hospital - 400m", "Orange Kitchen - 550m"],
    budget: [
      { name: "Fresh Lime Juice", price: "Rs. 420" },
      { name: "Egg Fried Rice", price: "Rs. 900" },
      { name: "Vegetable Kottu", price: "Rs. 950" },
    ],
    premium: [
      { name: "Mixed Grill (Meat)", price: "Rs. 4,950" },
      { name: "Seafood Platter", price: "Rs. 3,270" },
      { name: "Crabs Curry with Roast Paan (4 pcs)", price: "Rs. 2,900" },
    ],
    dietaryTags: ["Sri Lankan Classics", "Seafood", "Mocktails"],
    menuCategories: {
      breakfast: [
        { name: "Banana Smoothie", price: "Rs. 960" },
        { name: "Mango Smoothie", price: "Rs. 870" },
        { name: "Vanilla Malted Milkshake", price: "Rs. 960" },
      ],
      main: [
        { name: "Chicken Kottu", price: "Rs. 1,350" },
        { name: "Seafood Nasi Goreng", price: "Rs. 2,080" },
        { name: "Double Barrel Special Noodles", price: "Rs. 1,880" },
        { name: "Mixed Grill (Meat)", price: "Rs. 4,950" },
      ],
      drinks: [
        { name: "Fresh Lime Juice", price: "Rs. 420" },
        { name: "Coke Mojito", price: "Rs. 495" },
        { name: "Banana Lassi", price: "Rs. 870" },
      ],
    },
    reviewsPreview: [
      "Huge portions and lots of grill options",
      "Perfect for late-night kottu cravings",
      "Mocktails and smoothies were refreshing",
    ],
    mapQuery: "Double Barrel Restaurant Galle Sri Lanka",
    coordinates: { lat: 6.0535, lng: 80.221 },
  },
  {
    id: "mamasbakery",
    name: "Mamas Bakery & Cakery",
    location: "Galle",
    rating: 0,
    reviews: 0,
    price: "Budget",
    rankingScore: 0,
    image: "",
    desc: "Budget Friendly Bakery items and Cakes",
    hours: "6 AM - 9 PM",
    vibe: "Cakes | Pastries | Casual",
    bestTime: "5 PM - 9 PM",
    goodFor: ["Dinner", "Friends", "Lunch", "Short Eats"],
    address: "",
    nearby: ["Cake of clock - 300m"],
    budget: [{ name: "Fish Bun", price: "Rs. 90" }],
    premium: [{ name: "Seafood Platter", price: "Rs. 3500" }],
    dietaryTags: ["Vegetarian options"],
    menuCategories: {
      breakfast: [],
      main: [{ name: "Fried Rice", price: "Rs. 1200" }],
      drinks: [{ name: "Fresh Juice", price: "Rs. 500" }],
    },
    reviewsPreview: ["Nice place", "Good food", "Budget Friendly"],
    mapQuery: "Mamas Bakery & Cakery, Julgaha, Wakwella Road, Galle, Sri Lanka",
    coordinates: { lat: 6.06784, lng: 80.23533 },
  },
  {
  id: "teddiesahangama",
  name: "Teddies Ahangama - Rooftop Café",
  location: "Ahangama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Rooftop café with fresh food, relaxed vibe and great service.",
  hours: "8 AM - 10 PM",
  vibe: "Rooftop | Chill | Café",
  bestTime: "5 PM - 8 PM",
  goodFor: ["Dinner", "Couples", "Friends", "Brunch"],
  address: "Matara Rd, Ahangama, Sri Lanka",
  nearby: ["Ahangama Beach - 200m"],
  budget: [{ name: "Avocado Toast", price: "Rs. 1200" }],
  premium: [{ name: "Seafood Bowl", price: "Rs. 3500" }],
  dietaryTags: ["Vegetarian options", "Healthy"],
  menuCategories: {
    breakfast: [{ name: "Pancakes", price: "Rs. 1500" }],
    main: [{ name: "Burger", price: "Rs. 2200" }],
    drinks: [{ name: "Smoothie", price: "Rs. 900" }],
  },
  reviewsPreview: ["Amazing rooftop", "Fresh food", "Friendly staff"],
  mapQuery: "Teddies Ahangama Rooftop Café",
  coordinates: { lat: 5.9736, lng: 80.3612 },
},
{
  id: "echobeach",
  name: "Echo Beach Lounge",
  location: "Ahangama",
  rating: 0,
  reviews: 0,
  price: "Expensive",
  rankingScore: 0,
  image: "",
  desc: "Chilled beachfront lounge with cocktails and great vibes.",
  hours: "10 AM - 11 PM",
  vibe: "Beach | Chill | Cocktails",
  bestTime: "6 PM - 9 PM",
  goodFor: ["Dinner", "Friends", "Dates"],
  address: "No 110, Matara Rd, Ahangama",
  nearby: ["Ahangama Beach - 50m"],
  budget: [{ name: "Fries", price: "Rs. 800" }],
  premium: [{ name: "Grilled Seafood", price: "Rs. 4200" }],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Pasta", price: "Rs. 2500" }],
    drinks: [{ name: "Cocktail", price: "Rs. 1500" }],
  },
  reviewsPreview: ["Nice cocktails", "Beach vibe", "Relaxing place"],
  mapQuery: "Echo Beach Lounge Ahangama",
  coordinates: { lat: 5.9731, lng: 80.3605 },
},
{
  id: "labelle",
  name: "La Belle",
  location: "Ahangama",
  rating: 0,
  reviews: 0,
  price: "Expensive",
  rankingScore: 0,
  image: "",
  desc: "Trendy restaurant with great food, drinks and atmosphere.",
  hours: "9 AM - 11 PM",
  vibe: "Trendy | Social | Modern",
  bestTime: "7 PM - 10 PM",
  goodFor: ["Dinner", "Friends", "Dates"],
  address: "Galle Road, Ahangama",
  nearby: ["Surf Point - 300m"],
  budget: [{ name: "Pizza", price: "Rs. 2000" }],
  premium: [{ name: "Steak", price: "Rs. 4500" }],
  dietaryTags: ["Vegan options", "Vegetarian"],
  menuCategories: {
    breakfast: [{ name: "Egg Benedict", price: "Rs. 1800" }],
    main: [{ name: "Pasta", price: "Rs. 2800" }],
    drinks: [{ name: "Wine", price: "Rs. 2000" }],
  },
  reviewsPreview: ["Amazing vibe", "Great staff", "Tasty food"],
  mapQuery: "La Belle Ahangama",
  coordinates: { lat: 5.9742, lng: 80.3621 },
},
{
  id: "cocokitchen",
  name: "COCO Kitchen Ahangama",
  location: "Ahangama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Beautifully prepared food with outstanding service.",
  hours: "8 AM - 9 PM",
  vibe: "Cozy | Modern | Café",
  bestTime: "12 PM - 3 PM",
  goodFor: ["Lunch", "Brunch", "Couples"],
  address: "59 Matara Rd, Ahangama",
  nearby: ["Ahangama Beach - 150m"],
  budget: [{ name: "Rice & Curry", price: "Rs. 1500" }],
  premium: [{ name: "Seafood Dish", price: "Rs. 3500" }],
  dietaryTags: ["Vegan", "Vegetarian"],
  menuCategories: {
    breakfast: [{ name: "Smoothie Bowl", price: "Rs. 1200" }],
    main: [{ name: "Chicken Curry", price: "Rs. 2200" }],
    drinks: [{ name: "Fresh Juice", price: "Rs. 700" }],
  },
  reviewsPreview: ["Amazing food", "Great service", "Beautiful plating"],
  mapQuery: "COCO Kitchen Ahangama",
  coordinates: { lat: 5.9728, lng: 80.3609 },
},
{
  id: "craveahangama",
  name: "Crave Ahangama",
  location: "Ahangama",
  rating: 0,
  reviews: 0,
  price: "Expensive",
  rankingScore: 0,
  image: "",
  desc: "Stylish restaurant with professional service and delicious meals.",
  hours: "10 AM - 10 PM",
  vibe: "Modern | Stylish | Dining",
  bestTime: "7 PM - 9 PM",
  goodFor: ["Dinner", "Dates"],
  address: "54 Matara Rd, Ahangama",
  nearby: ["Beach - 100m"],
  budget: [{ name: "Burger", price: "Rs. 2200" }],
  premium: [{ name: "Seafood Platter", price: "Rs. 4000" }],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Pasta", price: "Rs. 2600" }],
    drinks: [{ name: "Mocktail", price: "Rs. 900" }],
  },
  reviewsPreview: ["Great service", "Delicious food", "Nice place"],
  mapQuery: "Crave Ahangama",
  coordinates: { lat: 5.9734, lng: 80.3610 },
},
{
  id: "vimaahangama",
  name: "Vima Ahangama",
  location: "Ahangama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Freshly prepared flavorful food with a cozy atmosphere.",
  hours: "9 AM - 9 PM",
  vibe: "Cozy | Casual | Friendly",
  bestTime: "1 PM - 4 PM",
  goodFor: ["Lunch", "Friends"],
  address: "Matara Rd, Ahangama",
  nearby: ["Surf Spot - 200m"],
  budget: [{ name: "Kottu", price: "Rs. 1200" }],
  premium: [{ name: "Seafood Rice", price: "Rs. 3000" }],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Fried Rice", price: "Rs. 1500" }],
    drinks: [{ name: "Lime Juice", price: "Rs. 500" }],
  },
  reviewsPreview: ["Very tasty", "Friendly staff", "Fresh food"],
  mapQuery: "Vima Ahangama",
  coordinates: { lat: 5.9725, lng: 80.3602 },
},
{
  id: "aftersurf",
  name: "After Surf Rooftop Cafe",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Popular rooftop café known for burgers, coffee, and chill surf vibes.",
  hours: "8 AM - 10 PM",
  vibe: "Rooftop | Chill | Surf Vibe",
  bestTime: "5 PM - 8 PM",
  goodFor: ["Dinner", "Friends", "Couples"],
  address: "Palabandara Watta, Weligama, Sri Lanka",
  nearby: ["Weligama Beach - 200m"],
  budget: [
    { name: "Chicken Burger", price: "Rs. 1500" }
  ],
  premium: [
    { name: "Seafood Platter", price: "Rs. 3500" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [{ name: "Avocado Toast", price: "Rs. 1200" }],
    main: [{ name: "Chicken Burger", price: "Rs. 1500" }],
    drinks: [{ name: "Iced Coffee", price: "Rs. 700" }]
  },
  reviewsPreview: [
    "Amazing rooftop vibe",
    "Best burger in Weligama",
    "Great service"
  ],
  mapQuery: "After Surf Rooftop Cafe Weligama Sri Lanka",
  coordinates: { lat: 5.974, lng: 80.429 }
},
{
  id: "maru",
  name: "MARU - Weligama",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Trendy restaurant offering Asian fusion dishes with a relaxed atmosphere.",
  hours: "11 AM - 10 PM",
  vibe: "Modern | Relaxed | Trendy",
  bestTime: "6 PM - 9 PM",
  goodFor: ["Dinner", "Couples", "Friends"],
  address: "496 Matara Rd, Weligama, Sri Lanka",
  nearby: ["Weligama Beach - 150m"],
  budget: [
    { name: "Rice & Curry", price: "Rs. 1200" }
  ],
  premium: [
    { name: "Tuna Steak", price: "Rs. 3200" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Tuna Steak", price: "Rs. 3200" }],
    drinks: [{ name: "Cocktail", price: "Rs. 1200" }]
  },
  reviewsPreview: [
    "Relaxing atmosphere",
    "Delicious food",
    "Great place to chill"
  ],
  mapQuery: "MARU Weligama Sri Lanka",
  coordinates: { lat: 5.9735, lng: 80.43 }
},
{
  id: "lefish",
  name: "Le' Fish Weligama",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Seafood-focused restaurant with fresh catch and coastal flavors.",
  hours: "12 PM - 10 PM",
  vibe: "Seafood | Cozy | Beachside",
  bestTime: "7 PM - 9 PM",
  goodFor: ["Dinner", "Couples"],
  address: "Weligama By Pass Rd, Weligama, Sri Lanka",
  nearby: ["Surf Point - 300m"],
  budget: [
    { name: "Fish Curry", price: "Rs. 1400" }
  ],
  premium: [
    { name: "Grilled Lobster", price: "Rs. 5000" }
  ],
  dietaryTags: ["Seafood", "Gluten-free options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Grilled Fish", price: "Rs. 2500" }],
    drinks: [{ name: "Fresh Lime Juice", price: "Rs. 500" }]
  },
  reviewsPreview: [
    "Fresh seafood",
    "Perfect ambiance",
    "Highly recommended"
  ],
  mapQuery: "Le Fish Weligama Sri Lanka",
  coordinates: { lat: 5.975, lng: 80.428 }
},
{
  id: "hungryfork",
  name: "Hungry Fork",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Budget-friendly spot serving tasty meals with excellent service.",
  hours: "10 AM - 9 PM",
  vibe: "Casual | Budget | Friendly",
  bestTime: "12 PM - 2 PM",
  goodFor: ["Lunch", "Friends", "Quick Bites"],
  address: "Weligama, Sri Lanka",
  nearby: ["Bus Stand - 200m"],
  budget: [
    { name: "Kottu", price: "Rs. 900" }
  ],
  premium: [
    { name: "Mixed Grill", price: "Rs. 2800" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Chicken Kottu", price: "Rs. 1000" }],
    drinks: [{ name: "Faluda", price: "Rs. 600" }]
  },
  reviewsPreview: [
    "Very friendly staff",
    "Delicious food",
    "Great value"
  ],
  mapQuery: "Hungry Fork Weligama Sri Lanka",
  coordinates: { lat: 5.9745, lng: 80.4295 }
},
{
  id: "cliff",
  name: "The Cliff Weligama",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Luxury",
  rankingScore: 0,
  image: "",
  desc: "Luxury dining experience with ocean views and high-end cuisine.",
  hours: "12 PM - 11 PM",
  vibe: "Luxury | Scenic | Romantic",
  bestTime: "6 PM - 8 PM",
  goodFor: ["Dinner", "Dates", "Special Occasions"],
  address: "241/89 Bandarawatte, Kapparathota, Weligama",
  nearby: ["Ocean Viewpoint - 50m"],
  budget: [
    { name: "Soup", price: "Rs. 1000" }
  ],
  premium: [
    { name: "Steak Dinner", price: "Rs. 8000" }
  ],
  dietaryTags: ["Fine dining", "Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Steak", price: "Rs. 8000" }],
    drinks: [{ name: "Wine Glass", price: "Rs. 2500" }]
  },
  reviewsPreview: [
    "Beautiful setting",
    "Great atmosphere",
    "Perfect for dates"
  ],
  mapQuery: "The Cliff Weligama Sri Lanka",
  coordinates: { lat: 5.972, lng: 80.426 }
},
{
  id: "delishpoint",
  name: "Delish Point",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Well-loved spot for seafood and pasta with a cozy atmosphere near the beach.",
  hours: "11 AM - 10 PM",
  vibe: "Cozy | Casual | Seafood",
  bestTime: "6 PM - 9 PM",
  goodFor: ["Dinner", "Couples", "Friends"],
  address: "Palena, 52 Matara Rd, Weligama, Sri Lanka",
  nearby: ["Weligama Beach - 100m"],
  budget: [
    { name: "Seafood Pasta", price: "Rs. 1800" }
  ],
  premium: [
    { name: "Grilled Seafood Platter", price: "Rs. 4000" }
  ],
  dietaryTags: ["Seafood", "Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Seafood Pasta", price: "Rs. 1800" }],
    drinks: [{ name: "Fresh Juice", price: "Rs. 600" }]
  },
  reviewsPreview: [
    "Amazing seafood pasta",
    "Great service",
    "Nice atmosphere"
  ],
  mapQuery: "Delish Point Weligama Sri Lanka",
  coordinates: { lat: 5.9738, lng: 80.4292 }
},
{
  id: "restaurantweligama",
  name: "Restaurant Weligama",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Popular all-round restaurant offering a variety of dishes with great ambiance.",
  hours: "10 AM - 10 PM",
  vibe: "Casual | Friendly | Local & Western",
  bestTime: "7 PM - 9 PM",
  goodFor: ["Dinner", "Family", "Friends"],
  address: "No.28 First Cross Road, Palana, Weligama, Sri Lanka",
  nearby: ["Surf Point - 200m"],
  budget: [
    { name: "Chicken Fried Rice", price: "Rs. 1200" }
  ],
  premium: [
    { name: "Mixed Seafood Dish", price: "Rs. 3000" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Fried Rice", price: "Rs. 1200" }],
    drinks: [{ name: "Milkshake", price: "Rs. 700" }]
  },
  reviewsPreview: [
    "Great ambiance",
    "Excellent service",
    "Tasty food"
  ],
  mapQuery: "Restaurant Weligama Sri Lanka",
  coordinates: { lat: 5.9742, lng: 80.4288 }
},
{
  id: "sanarestaurant",
  name: "Sana Restaurant",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Affordable restaurant known for flavorful meals and friendly service.",
  hours: "10 AM - 9 PM",
  vibe: "Budget | Cozy | Friendly",
  bestTime: "12 PM - 2 PM",
  goodFor: ["Lunch", "Friends", "Quick Bites"],
  address: "Pelana, 16 Modara Waththa, Weligama, Sri Lanka",
  nearby: ["Main Road - 150m"],
  budget: [
    { name: "Rice & Curry", price: "Rs. 900" }
  ],
  premium: [
    { name: "Chicken Devilled", price: "Rs. 1800" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Rice & Curry", price: "Rs. 900" }],
    drinks: [{ name: "Lime Juice", price: "Rs. 400" }]
  },
  reviewsPreview: [
    "Great experience",
    "Delicious meals",
    "Affordable prices"
  ],
  mapQuery: "Sana Restaurant Weligama Sri Lanka",
  coordinates: { lat: 5.9752, lng: 80.4302 }
},
{
  id: "tittupvine",
  name: "Tittup Vine Restaurant",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Stylish restaurant serving fresh, well-presented dishes with a relaxed vibe.",
  hours: "11 AM - 10 PM",
  vibe: "Stylish | Relaxed | Modern",
  bestTime: "6 PM - 9 PM",
  goodFor: ["Dinner", "Couples", "Friends"],
  address: "498/1 Matara Road, Palana, Weligama, Sri Lanka",
  nearby: ["Beach Area - 250m"],
  budget: [
    { name: "Chicken Pasta", price: "Rs. 1600" }
  ],
  premium: [
    { name: "Seafood Platter", price: "Rs. 3500" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Chicken Pasta", price: "Rs. 1600" }],
    drinks: [{ name: "Iced Tea", price: "Rs. 500" }]
  },
  reviewsPreview: [
    "Beautiful presentation",
    "Fresh food",
    "Nice atmosphere"
  ],
  mapQuery: "Tittup Vine Restaurant Weligama Sri Lanka",
  coordinates: { lat: 5.9739, lng: 80.4297 }
},
{
  id: "societyunawatuna",
  name: "Society Unawatuna",
  location: "Unawatuna",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Trendy café serving smoothie bowls, breakfast dishes, and healthy meals.",
  hours: "8 AM - 10:30 PM",
  vibe: "Healthy | Cafe | Chill",
  bestTime: "9 AM - 12 PM",
  goodFor: ["Breakfast", "Brunch", "Friends"],
  address: "43A Yaddehimulla Road, Unawatuna, Sri Lanka",
  nearby: ["Unawatuna Beach - 200m"],
  budget: [
    { name: "Smoothie Bowl", price: "Rs. 1200" }
  ],
  premium: [
    { name: "Brunch Platter", price: "Rs. 2500" }
  ],
  dietaryTags: ["Vegan options", "Vegetarian options"],
  menuCategories: {
    breakfast: [{ name: "Smoothie Bowl", price: "Rs. 1200" }],
    main: [{ name: "Avocado Toast", price: "Rs. 1500" }],
    drinks: [{ name: "Fresh Juice", price: "Rs. 600" }]
  },
  reviewsPreview: [
    "Great healthy food",
    "Nice vibe",
    "Perfect brunch spot"
  ],
  mapQuery: "Society Unawatuna Sri Lanka",
  coordinates: { lat: 6.0098, lng: 80.249 }
},
{
  id: "chillhouse",
  name: "Chill House Restaurant Tangalle",
  location: "Tangalle",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Highly rated restaurant known for fresh, flavorful dishes and relaxing ambiance.",
  hours: "10 AM - 10 PM",
  vibe: "Chill | Cozy | Relaxed",
  bestTime: "6 PM - 9 PM",
  goodFor: ["Dinner", "Friends", "Couples"],
  address: "32 Dipankara Road, Madakatiya, Tangalle, Sri Lanka",
  nearby: ["Tangalle Beach - 300m"],
  budget: [
    { name: "Rice & Curry", price: "Rs. 1000" }
  ],
  premium: [
    { name: "Seafood Plate", price: "Rs. 3000" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Rice & Curry", price: "Rs. 1000" }],
    drinks: [{ name: "Fruit Juice", price: "Rs. 500" }]
  },
  reviewsPreview: [
    "Fresh and delicious",
    "Beautiful presentation",
    "Highly recommended"
  ],
  mapQuery: "Chill House Restaurant Tangalle Sri Lanka",
  coordinates: { lat: 5.967, lng: 80.764 }
},
{
  id: "letssea",
  name: "Let’s Sea",
  location: "Tangalle",
  rating: 0,
  reviews: 0,
  price: "Expensive",
  rankingScore: 0,
  image: "",
  desc: "Modern seaside restaurant offering great cocktails and delicious meals.",
  hours: "11 AM - 10 PM",
  vibe: "Beachside | Modern | Chill",
  bestTime: "6 PM - 9 PM",
  goodFor: ["Dinner", "Couples", "Friends"],
  address: "33 Vijaya Rd, Tangalle, Sri Lanka",
  nearby: ["Beachfront - 100m"],
  budget: [
    { name: "Pasta", price: "Rs. 2000" }
  ],
  premium: [
    { name: "Seafood Platter", price: "Rs. 4500" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Seafood Pasta", price: "Rs. 2200" }],
    drinks: [{ name: "Cocktail", price: "Rs. 1300" }]
  },
  reviewsPreview: [
    "Great cocktails",
    "Delicious food",
    "Nice beach vibe"
  ],
  mapQuery: "Lets Sea Tangalle Sri Lanka",
  coordinates: { lat: 5.9665, lng: 80.763 }
},
{
  id: "cactuslounge",
  name: "Cactus Lounge Restaurant",
  location: "Weligama",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Popular restaurant known for generous portions and tasty meals.",
  hours: "10 AM - 10 PM",
  vibe: "Casual | Lively | Social",
  bestTime: "7 PM - 9 PM",
  goodFor: ["Dinner", "Friends"],
  address: "435/7 Matara Rd, Weligama, Sri Lanka",
  nearby: ["Main Road - 100m"],
  budget: [
    { name: "Burger Meal", price: "Rs. 1500" }
  ],
  premium: [
    { name: "Mixed Grill", price: "Rs. 3200" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Chicken Burger", price: "Rs. 1500" }],
    drinks: [{ name: "Milkshake", price: "Rs. 700" }]
  },
  reviewsPreview: [
    "Huge portions",
    "Great sides",
    "Very tasty"
  ],
  mapQuery: "Cactus Lounge Weligama Sri Lanka",
  coordinates: { lat: 5.9741, lng: 80.429 }
},
{
  id: "mangoshade",
  name: "Mango Shade",
  location: "Tangalle",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Family-friendly restaurant with excellent food and welcoming service.",
  hours: "10 AM - 10 PM",
  vibe: "Family | Cozy | Friendly",
  bestTime: "6 PM - 9 PM",
  goodFor: ["Family", "Dinner", "Friends"],
  address: "141 Pagngnawasa Mawatha, Tangalle, Sri Lanka",
  nearby: ["Town Center - 200m"],
  budget: [
    { name: "Rice & Curry", price: "Rs. 1200" }
  ],
  premium: [
    { name: "Seafood Dish", price: "Rs. 3000" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [{ name: "Rice & Curry", price: "Rs. 1200" }],
    drinks: [{ name: "Fruit Juice", price: "Rs. 500" }]
  },
  reviewsPreview: [
    "Amazing service",
    "Great food",
    "Family friendly"
  ],
  mapQuery: "Mango Shade Tangalle Sri Lanka",
  coordinates: { lat: 5.9675, lng: 80.7645 }
},
{
  id: "dewminiRotiMirissa",
  name: "No.1 Dewmini Roti Shop",
  location: "Mirissa",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Famous family-run roti shop started as a small roadside stall, now a must-visit in Mirissa for sweet and savory rotis.",
  hours: "8:30 AM - 10 PM",
  vibe: "Street Food | Family Run | Casual",
  bestTime: "10 AM - 8 PM",
  goodFor: ["Rotis", "Budget food", "Quick meals", "Snacks"],
  address: "Mirissa main road",
  nearby: ["Mirissa Beach - 400m"],
  budget: [
    { name: "Vegetable Roti", price: "Rs. 300 - 800" },
    { name: "Chocolate Roti", price: "Rs. 300 - 700" }
  ],
  premium: [
    { name: "Chicken Roti Combo", price: "Rs. 1200" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [
      { name: "Vegetable Roti", price: "Rs. 300 - 800" },
      { name: "Chicken Roti", price: "Rs. 600 - 1,200" }
    ],
    drinks: [
      { name: "King Coconut", price: "Rs. 300" },
      { name: "Fresh Juice", price: "Rs. 500" }
    ]
  },
  reviewsPreview: [
    "Best rotis in Mirissa",
    "Very cheap and tasty",
    "Always crowded in evenings"
  ],
  mapQuery: "Dewmini Roti Shop Mirissa Sri Lanka",
  coordinates: { lat: 5.9472, lng: 80.4617 }
},
{
  id: "sunriseFamilyKitchenUnawatuna",
  name: "Sunrise Family Kitchen",
  location: "Unawatuna",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Small family-run home kitchen serving authentic Sri Lankan rice & curry with a homely garden setting.",
  hours: "8 AM - 9 PM",
  vibe: "Home Cooked | Quiet | Local",
  bestTime: "12 PM - 3 PM",
  goodFor: ["Rice & curry", "Budget meals", "Local experience"],
  address: "Near Yaddehimulla Rd, Unawatuna",
  nearby: ["Unawatuna Beach - 500m"],
  budget: [
    { name: "Rice & Curry Set", price: "Rs. 800 - 1,200" }
  ],
  premium: [
    { name: "Fish Curry Meal", price: "Rs. 1,500" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [
      { name: "Chicken Curry", price: "Rs. 1,200" },
      { name: "Vegetable Rice & Curry", price: "Rs. 800" }
    ],
    drinks: [
      { name: "Fresh Lime Juice", price: "Rs. 400" }
    ]
  },
  reviewsPreview: [
    "Very homely taste",
    "Fresh Sea food",
    "Friendly family service"
  ],
  mapQuery: "Sunrise Family Kitchen Unawatuna",
  coordinates: { lat: 6.0132, lng: 80.2451 }
},
{
  id: "shanBakersGalle",
  name: "Shan Bakers",
  location: "Galle",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Popular local bakery in Galle known for fresh bread, short eats, and affordable Sri Lankan snacks.",
  hours: "6 AM - 10 PM",
  vibe: "Local Bakery | Busy | Budget Friendly",
  bestTime: "7 AM - 10 AM",
  goodFor: ["Breakfast", "Short eats", "Tea snacks"],
  address: "Galle town center",
  nearby: ["Galle Fort - 1.2km"],
  budget: [
    { name: "Bread loaf", price: "Rs. 200 - 400" }
  ],
  premium: [
    { name: "Chicken buns combo", price: "Rs. 600" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [
      { name: "Egg bun", price: "Rs. 120" },
      { name: "Fish bun", price: "Rs. 150" }
    ],
    main: [
      { name: "Chicken roll", price: "Rs. 200" },
      { name: "Kimbula bun", price: "Rs. 100" }
    ],
    drinks: [
      { name: "Milk tea", price: "Rs. 150" }
    ]
  },
  reviewsPreview: [
    "Fresh bakery items daily",
    "Cheap and tasty snacks",
    "Very popular in Galle"
  ],
  mapQuery: "Shan Bakers Galle",
  coordinates: { lat: 6.0329, lng: 80.2168 }
},

{
  id: "southCeylonBakeryGalle",
  name: "South Ceylon Bakery",
  location: "Galle",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Modern-style bakery in Galle offering a mix of Sri Lankan pastries and Western baked goods.",
  hours: "7 AM - 9 PM",
  vibe: "Modern Bakery | Clean | Family Friendly",
  bestTime: "8 AM - 11 AM",
  goodFor: ["Breakfast", "Cakes", "Coffee snacks"],
  address: "Near Galle main road",
  nearby: ["Galle Railway Station - 800m"],
  budget: [
    { name: "Tea + pastry combo", price: "Rs. 350" }
  ],
  premium: [
    { name: "Chocolate cake slice", price: "Rs. 600" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [
      { name: "Butter croissant", price: "Rs. 250" },
      { name: "Egg sandwich", price: "Rs. 300" }
    ],
    main: [
      { name: "Chicken puff", price: "Rs. 220" },
      { name: "Cheese roll", price: "Rs. 250" }
    ],
    drinks: [
      { name: "Cappuccino", price: "Rs. 400" }
    ]
  },
  reviewsPreview: [
    "Clean and modern bakery",
    "Great coffee and cakes",
    "Good service"
  ],
  mapQuery: "South Ceylon Bakery Galle",
  coordinates: { lat: 6.0535, lng: 80.2210 }
},
{
  id: "bakeNTakeGalle",
  name: "Bake 'n' Take",
  location: "Galle",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Popular bakery chain outlet in Galle offering fresh bread, pastries, and short eats.",
  hours: "6 AM - 10 PM",
  vibe: "Chain Bakery | Busy | Budget Friendly",
  bestTime: "7 AM - 10 AM",
  goodFor: ["Breakfast", "Short eats", "Tea snacks"],
  address: "Galle town",
  nearby: ["Galle Railway Station - 1km"],
  budget: [
    { name: "Bread loaf", price: "Rs. 250 - 450" }
  ],
  premium: [
    { name: "Chicken roll combo", price: "Rs. 700" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [
      { name: "Chicken bun", price: "Rs. 180" },
      { name: "Fish roll", price: "Rs. 220" }
    ],
    drinks: [
      { name: "Milk tea", price: "Rs. 150" }
    ]
  },
  reviewsPreview: [],
  mapQuery: "Bake n Take Galle",
  coordinates: { lat: 6.0535, lng: 80.2210 }
},
{
  id: "wijayagiriBakeryGalle",
  name: "Wijayagiri Bakery",
  location: "Galle",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Local bakery in Galle known for fresh buns, cakes, and traditional short eats.",
  hours: "6 AM - 9 PM",
  vibe: "Local Bakery | Simple | Budget",
  bestTime: "7 AM - 11 AM",
  goodFor: ["Breakfast", "Bakery snacks"],
  address: "Galle area",
  nearby: ["Galle town - 1km"],
  budget: [
    { name: "Butter bun", price: "Rs. 100" }
  ],
  premium: [
    { name: "Cake slice", price: "Rs. 400" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [
      { name: "Fish bun", price: "Rs. 150" },
      { name: "Chicken bun", price: "Rs. 180" }
    ],
    drinks: [
      { name: "Tea", price: "Rs. 120" }
    ]
  },
  reviewsPreview: [],
  mapQuery: "Wijayagiri Bakery Galle",
  coordinates: { lat: 6.0500, lng: 80.2200 }
},
{
  id: "malruBunAndCakeGalle",
  name: "MALRU Bun & Cake",
  location: "Galle",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Small bakery offering buns, cakes, and sweet items in Galle area.",
  hours: "7 AM - 9 PM",
  vibe: "Local Bakery | Sweet | Casual",
  bestTime: "8 AM - 11 AM",
  goodFor: ["Snacks", "Tea time"],
  address: "Galle",
  nearby: ["Galle town - 1km"],
  budget: [
    { name: "Sweet bun", price: "Rs. 120" }
  ],
  premium: [
    { name: "Cake slice", price: "Rs. 450" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [
      { name: "Butter bun", price: "Rs. 100" }
    ],
    drinks: [
      { name: "Tea", price: "Rs. 120" }
    ]
  },
  reviewsPreview: [],
  mapQuery: "Malru Bun and Cake Galle",
  coordinates: { lat: 6.0450, lng: 80.2150 }
},
{
  id: "bakersDelightGalle",
  name: "Bakers' Delight",
  location: "Galle",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Well-known bakery offering a variety of breads, cakes, and snacks.",
  hours: "6 AM - 10 PM",
  vibe: "Modern Bakery | Popular | Clean",
  bestTime: "7 AM - 11 AM",
  goodFor: ["Breakfast", "Cakes", "Snacks"],
  address: "Galle area",
  nearby: ["Galle town - 1.5km"],
  budget: [
    { name: "Bread loaf", price: "Rs. 300" }
  ],
  premium: [
    { name: "Birthday cake", price: "Rs. 3,000+" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [
      { name: "Chicken puff", price: "Rs. 250" }
    ],
    drinks: [
      { name: "Coffee", price: "Rs. 300" }
    ]
  },
  reviewsPreview: [],
  mapQuery: "Bakers Delight Galle",
  coordinates: { lat: 6.0550, lng: 80.2230 }
},

{
  id: "bunAndCakeHapugala",
  name: "Bun & Cake Hapugala",
  location: "Hapugala, Galle",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Small roadside bakery in Hapugala offering buns and simple cakes.",
  hours: "6 AM - 8 PM",
  vibe: "Roadside | Local | Budget",
  bestTime: "7 AM - 10 AM",
  goodFor: ["Quick snacks", "Tea"],
  address: "Hapugala, Galle",
  nearby: ["Hapugala junction"],
  budget: [
    { name: "Butter bun", price: "Rs. 100" }
  ],
  premium: [],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [],
    drinks: [
      { name: "Tea", price: "Rs. 100" }
    ]
  },
  reviewsPreview: [],
  mapQuery: "Bun and Cake Hapugala",
  coordinates: { lat: 6.1000, lng: 80.2500 }
},

{
  id: "darPoronuPanBakeryGalle",
  name: "?? ????? ???? - Bakery",
  location: "Galle",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Traditional wood-fired bread bakery offering authentic Sri Lankan style bread.",
  hours: "5 AM - 11 AM",
  vibe: "Traditional | Local | Fresh Bread",
  bestTime: "Early Morning",
  goodFor: ["Fresh bread", "Breakfast"],
  address: "Galle area",
  nearby: ["Local village bakeries"],
  budget: [
    { name: "Wood-fired bread", price: "Rs. 150 - 300" }
  ],
  premium: [],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [
      { name: "Fresh bread", price: "Rs. 150" }
    ],
    main: [],
    drinks: []
  },
  reviewsPreview: [],
  mapQuery: "Dar Poronu Pan Bakery Galle",
  coordinates: { lat: 6.0400, lng: 80.2100 }
},

{
  id: "dilaSweetLabGalle",
  name: "Dila Sweet Lab",
  location: "Galle",
  rating: 0,
  reviews: 0,
  price: "Moderate",
  rankingScore: 0,
  image: "",
  desc: "Modern dessert lab in Galle specializing in sweets, cakes, and creative desserts.",
  hours: "10 AM - 9 PM",
  vibe: "Dessert Lab | Modern | Sweet",
  bestTime: "2 PM - 8 PM",
  goodFor: ["Desserts", "Cakes", "Sweet cravings"],
  address: "Galle",
  nearby: ["Galle Fort - 1km"],
  budget: [
    { name: "Dessert cup", price: "Rs. 500" }
  ],
  premium: [
    { name: "Signature cake", price: "Rs. 2,500+" }
  ],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [],
    drinks: [
      { name: "Milkshake", price: "Rs. 600" }
    ]
  },
  reviewsPreview: [],
  mapQuery: "Dila Sweet Lab Galle",
  coordinates: { lat: 6.0300, lng: 80.2200 }
},

{
  id: "breadMartHapugala",
  name: "Bread Mart Hapugala",
  location: "Hapugala, Galle",
  rating: 0,
  reviews: 0,
  price: "Budget",
  rankingScore: 0,
  image: "",
  desc: "Local bakery and bread shop serving fresh daily bread and snacks in Hapugala.",
  hours: "6 AM - 8 PM",
  vibe: "Local Shop | Budget | Simple",
  bestTime: "Morning",
  goodFor: ["Bread", "Quick snacks"],
  address: "Hapugala, Galle",
  nearby: ["Hapugala junction"],
  budget: [
    { name: "Bread loaf", price: "Rs. 200" }
  ],
  premium: [],
  dietaryTags: ["Vegetarian options"],
  menuCategories: {
    breakfast: [],
    main: [],
    drinks: []
  },
  reviewsPreview: [],
  mapQuery: "Bread Mart Hapugala",
  coordinates: { lat: 6.1020, lng: 80.2520 }
}




  
];

const toRadians = (value) => (value * Math.PI) / 180;

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const resolveLocationCenter = async (locationName) => {
  const normalizedName = String(locationName || "").trim();
  if (!normalizedName) return null;
  if (geocodeCache.has(normalizedName)) return geocodeCache.get(normalizedName);

  const fallbackKey = Object.keys(locationCenters).find(
    (key) => key.toLowerCase() === normalizedName.toLowerCase()
  );
  const fallback = (fallbackKey && locationCenters[fallbackKey]) || null;
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!key) {
    geocodeCache.set(normalizedName, fallback);
    return fallback;
  }

  try {
    const query = encodeURIComponent(`${normalizedName}, Sri Lanka`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${key}`;
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok && data.status === "OK" && data.results?.length > 0) {
      const coords = data.results[0].geometry.location;
      const center = { lat: coords.lat, lng: coords.lng };
      geocodeCache.set(normalizedName, center);
      return center;
    }
  } catch (error) {
    console.warn("Google geocoding failed:", error.message);
  }

  geocodeCache.set(normalizedName, fallback);
  return fallback;
};

const getPriceMatchScore = (preferredPrice, restaurantPrice) => {
  if (!preferredPrice) return 7;
  const normalizedPreferred = normalizePriceRange(preferredPrice);
  const normalizedRestaurant = normalizePriceRange(restaurantPrice);
  if (normalizedPreferred && normalizedPreferred === normalizedRestaurant) return 10;

  const preferredLevel = getPriceRangeLevel(normalizedPreferred);
  const restaurantLevel = getPriceRangeLevel(normalizedRestaurant);

  if (!preferredLevel || !restaurantLevel) return 5;
  const diff = Math.abs(preferredLevel - restaurantLevel);
  if (diff === 1) return 6;
  return 3;
};

const getPreferenceScore = (search, restaurant) => {
  if (!search || !search.trim()) return 6;

  const terms = search
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));

  if (terms.length === 0) return 6;

  const searchableText = [
    restaurant.name,
    restaurant.location,
    restaurant.vibe,
    restaurant.desc,
    ...(restaurant.goodFor || []),
  ]
    .join(" ")
    .toLowerCase();

  const matches = terms.filter((term) => searchableText.includes(term)).length;
  return Number(((matches / terms.length) * 10).toFixed(2));
};

const getPreferenceMatches = (search, restaurant) => {
  if (!search || !search.trim()) return [];

  const terms = search
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));

  if (terms.length === 0) return [];

  const searchableText = [
    restaurant.name,
    restaurant.location,
    restaurant.vibe,
    restaurant.desc,
    ...(restaurant.goodFor || []),
  ]
    .join(" ")
    .toLowerCase();

  const matched = terms.filter((term) => searchableText.includes(term));
  return Array.from(new Set(matched)).slice(0, 4);
};

const buildWhyRecommended = ({ restaurant, context, scoreBreakdown }) => {
  if (!restaurant || !scoreBreakdown) return "";

  const rating = Number(restaurant.rating || 0);
  const reviews = Number(restaurant.reviews || 0);
  const distanceKm = typeof restaurant.distanceKm === "number" ? restaurant.distanceKm : null;

  const candidates = [];

  if (Number.isFinite(rating) && rating > 0) {
    const label =
      rating >= 4.4 ? "Highly rated" : rating >= 3.9 ? "Good rating" : "Rated";
    candidates.push({
      key: "rating",
      score: Number(scoreBreakdown.ratingScore || 0),
      text: `${label} (${rating.toFixed(1)}/5)`,
      priority: 1,
    });
  }

  if (Number.isFinite(reviews) && reviews > 0) {
    const label = reviews >= 30 ? `Popular (${reviews} reviews)` : `${reviews} reviews`;
    candidates.push({
      key: "reviews",
      score: Number(scoreBreakdown.reviewConfidenceScore || 0),
      text: label,
      priority: 2,
    });
  }

  if (distanceKm !== null && Number.isFinite(distanceKm) && distanceKm >= 0) {
    candidates.push({
      key: "distance",
      score: Number(scoreBreakdown.distanceScore || 0),
      text: `Close to you (${distanceKm.toFixed(1)} km)`,
      priority: 3,
    });
  }

  if (context?.preferredPrice) {
    const normalizedRestaurantPrice = normalizePriceRange(restaurant.price);
    const normalizedPreferredPrice = normalizePriceRange(context.preferredPrice);
    const price =
      normalizedRestaurantPrice ||
      normalizedPreferredPrice ||
      restaurant.price ||
      context.preferredPrice;
    const label =
      normalizedRestaurantPrice &&
      normalizedPreferredPrice &&
      normalizedRestaurantPrice === normalizedPreferredPrice
        ? `Matches your budget (${price})`
        : `Similar price range (${price})`;

    candidates.push({
      key: "price",
      score: Number(scoreBreakdown.priceMatchScore || 0),
      text: label,
      priority: 4,
    });
  }

  if (context?.search) {
    const matchedTerms = getPreferenceMatches(context.search, restaurant);
    if (matchedTerms.length > 0) {
      candidates.push({
        key: "preference",
        score: Number(scoreBreakdown.preferenceMatchScore || 0),
        text: `Matches: ${matchedTerms.slice(0, 2).join(", ")}`,
        priority: 5,
      });
    }
  }

  const top = candidates
    .sort((a, b) => b.score - a.score || a.priority - b.priority)
    .slice(0, 2)
    .map((item) => item.text)
    .filter(Boolean);

  return top.join(" • ");
};

const getWeightedRatingScore = (restaurant, options = {}) => {
  const { C = 3.5, m = 50 } = options;
  const reviewCountRaw = Number(restaurant.reviews);
  const reviewCount = Number.isFinite(reviewCountRaw) && reviewCountRaw > 0 ? reviewCountRaw : 0;

  const ratingRaw = Number(restaurant.rating);
  const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : C;

  const weightedRating = (rating * reviewCount + C * m) / (reviewCount + m);
  const clampedRating = Math.min(5, Math.max(0, weightedRating));
  return Number(((clampedRating / 5) * 10).toFixed(2));
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildScoredRestaurant = (restaurant, context) => {
  const reviewsRaw = Number(restaurant.reviews);
  const reviewCount = Number.isFinite(reviewsRaw) && reviewsRaw > 0 ? reviewsRaw : 0;

  if (reviewCount === 0) {
    return {
      ...restaurant,
      rating: 0,
      reviews: 0,
      aiScore: 0,
      rankingScore: 0,
      whyRecommended: "New place — be the first to review",
      scoreBreakdown: {
        ratingScore: 0,
        reviewConfidenceScore: 0,
        distanceScore: 0,
        priceMatchScore: 0,
        preferenceMatchScore: 0,
      },
    };
  }

  const ratingScore = getWeightedRatingScore(restaurant);
  const reviewConfidenceScore = Number(
    Math.min(10, Math.log10((restaurant.reviews || 0) + 1) * 3.7).toFixed(2)
  );
  const priceMatchScore = getPriceMatchScore(context.preferredPrice, restaurant.price);
  const preferenceMatchScore = getPreferenceScore(context.search, restaurant);

  let distanceScore = 6;
  if (typeof restaurant.distanceKm === "number" && context.maxDistanceKm > 0) {
    const rawDistanceScore = 10 * (1 - restaurant.distanceKm / context.maxDistanceKm);
    distanceScore = Number(Math.max(0, rawDistanceScore).toFixed(2));
  }

  const rankingScoreRaw =
    ratingScore * 0.4 +
    reviewConfidenceScore * 0.2 +
    distanceScore * 0.2 +
    priceMatchScore * 0.1 +
    preferenceMatchScore * 0.1;

  const rankingScore = Number(rankingScoreRaw.toFixed(1));
  const scoreBreakdown = {
    ratingScore,
    reviewConfidenceScore,
    distanceScore,
    priceMatchScore,
    preferenceMatchScore,
  };

  return {
    ...restaurant,
    aiScore: rankingScore,
    rankingScore,
    whyRecommended: buildWhyRecommended({ restaurant, context, scoreBreakdown }),
    scoreBreakdown,
  };
};

const attachReviewMetrics = async (restaurants) => {
  if (!Array.isArray(restaurants) || restaurants.length === 0) return restaurants;

  const ids = restaurants.map((restaurant) => restaurant.id).filter(Boolean);
  if (ids.length === 0) return restaurants;

  const metrics = await Review.aggregate([
    { $match: { restaurantId: { $in: ids } } },
    {
      $group: {
        _id: "$restaurantId",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const metricsMap = new Map(
    metrics.map((row) => [
      String(row._id),
      {
        rating: Number(Number(row.averageRating || 0).toFixed(1)),
        reviews: Number(row.totalReviews || 0),
      },
    ])
  );

  return restaurants.map((restaurant) => {
    const metric = metricsMap.get(String(restaurant.id));
    if (!metric || metric.reviews <= 0) {
      return { ...restaurant, rating: 0, reviews: 0 };
    }
    return { ...restaurant, rating: metric.rating, reviews: metric.reviews };
  });
};

const formatLkrPrice = (value) => {
  if (value === null || value === undefined) return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return value;
    const rounded = Math.round(value);
    return `Rs. ${rounded.toLocaleString("en-US")}`;
  }

  const raw = String(value).trim();
  const match = raw.match(/(\d[\d,]*)(?:\.\d+)?/);
  if (!match) return value;

  const digits = match[1].replace(/,/g, "");
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed)) return value;

  return `Rs. ${parsed.toLocaleString("en-US")}`;
};

const normalizeMenuItem = (item) => {
  if (!item || typeof item !== "object") return item;
  if (!("price" in item)) return item;
  return { ...item, price: formatLkrPrice(item.price) };
};

const normalizeMenuList = (items) => (Array.isArray(items) ? items.map(normalizeMenuItem) : items);

const normalizeMenuCategories = (menuCategories) => {
  if (!menuCategories || typeof menuCategories !== "object") return menuCategories;

  const normalized = {};
  for (const [key, value] of Object.entries(menuCategories)) {
    normalized[key] = normalizeMenuList(value);
  }

  return normalized;
};

const normalizeSeedRestaurant = (restaurant) => {
  if (!restaurant || typeof restaurant !== "object") return restaurant;

  return {
    ...restaurant,
    rating: 0,
    reviews: 0,
    aiScore: 0,
    rankingScore: 0,
    budget: normalizeMenuList(restaurant.budget),
    premium: normalizeMenuList(restaurant.premium),
    menuCategories: normalizeMenuCategories(restaurant.menuCategories),
  };
};

const seedRestaurants = sampleRestaurants.map(normalizeSeedRestaurant);

const ensureSeedData = async () => {
  if (!seedInitialized) {
    // Remove legacy IDs created during local renaming, so only the current seed IDs remain.
    if (legacyRestaurantIds.length > 0) {
      await Restaurant.deleteMany({ id: { $in: legacyRestaurantIds } });
    }

    const operations = seedRestaurants.map((restaurant) => {
      const { price, menuCategories, dietaryTags, budget, premium, ...restaurantOnInsert } =
        restaurant;
      return {
        updateOne: {
          filter: { id: restaurant.id },
          update: {
            $setOnInsert: { ...restaurantOnInsert, isSeeded: true },
            $set: { isSeeded: true, price, menuCategories, dietaryTags, budget, premium },
          },
          upsert: true,
        },
      };
    });

    await Restaurant.bulkWrite(operations);
    await Promise.all(seedRestaurants.map((restaurant) => syncRestaurantReviewMetrics(restaurant.id)));
    seedInitialized = true;
  }

  const kaiRestaurant = seedRestaurants.find((restaurant) => restaurant.id === "kai-ahangama");
  if (kaiRestaurant) {
    await Restaurant.updateOne(
      { id: kaiRestaurant.id },
      {
        $set: {
          budget: kaiRestaurant.budget,
          premium: kaiRestaurant.premium,
          dietaryTags: kaiRestaurant.dietaryTags,
          menuCategories: kaiRestaurant.menuCategories,
          nearby: kaiRestaurant.nearby,
          hours: kaiRestaurant.hours,
          address: kaiRestaurant.address,
          mapQuery: kaiRestaurant.mapQuery,
          coordinates: kaiRestaurant.coordinates,
        },
      }
    );
  }

  const sahanaRestaurant = seedRestaurants.find((restaurant) => restaurant.id === "sahana-urban");
  if (sahanaRestaurant) {
    await Restaurant.updateOne(
      { id: sahanaRestaurant.id },
      {
        $set: {
          budget: sahanaRestaurant.budget,
          premium: sahanaRestaurant.premium,
          dietaryTags: sahanaRestaurant.dietaryTags,
          menuCategories: sahanaRestaurant.menuCategories,
          nearby: sahanaRestaurant.nearby,
          hours: sahanaRestaurant.hours,
          address: sahanaRestaurant.address,
        },
      }
    );
  }

  const cactusRestaurant = seedRestaurants.find((restaurant) => restaurant.id === "cactus-ahangama");
  if (cactusRestaurant) {
    await Restaurant.updateOne(
      {
        id: cactusRestaurant.id,
        $or: [
          { "menuCategories.breakfast.0": { $exists: false } },
          { "menuCategories.main.0": { $exists: false } },
          { "menuCategories.drinks.0": { $exists: false } },
        ],
      },
      {
        $set: {
          name: cactusRestaurant.name,
          desc: cactusRestaurant.desc,
          hours: cactusRestaurant.hours,
          vibe: cactusRestaurant.vibe,
          bestTime: cactusRestaurant.bestTime,
          goodFor: cactusRestaurant.goodFor,
          address: cactusRestaurant.address,
          nearby: cactusRestaurant.nearby,
          dietaryTags: cactusRestaurant.dietaryTags,
          menuCategories: cactusRestaurant.menuCategories,
          mapQuery: cactusRestaurant.mapQuery,
          coordinates: cactusRestaurant.coordinates,
        },
      }
    );
  }

  const hasaraRestaurant = seedRestaurants.find((restaurant) => restaurant.id === "hasarahotel");
  if (hasaraRestaurant) {
    await Restaurant.updateOne(
      { id: hasaraRestaurant.id },
      {
        $set: {
          name: hasaraRestaurant.name,
        },
      }
    );
  }

  const fortHeritageRestaurant = seedRestaurants.find(
    (restaurant) => restaurant.id === "fortheritagecabin"
  );
  if (fortHeritageRestaurant) {
    await Restaurant.updateOne(
      {
        id: fortHeritageRestaurant.id,
        $or: [
          { hours: { $in: [null, ""] } },
          { vibe: { $in: [null, ""] } },
          { bestTime: { $in: [null, ""] } },
          { address: { $in: [null, ""] } },
          { "goodFor.0": { $exists: false } },
          { "menuCategories.main.0": { $exists: false } },
        ],
      },
      {
        $set: {
          name: fortHeritageRestaurant.name,
          location: fortHeritageRestaurant.location,
          price: fortHeritageRestaurant.price,
          desc: fortHeritageRestaurant.desc,
          hours: fortHeritageRestaurant.hours,
          vibe: fortHeritageRestaurant.vibe,
          bestTime: fortHeritageRestaurant.bestTime,
          goodFor: fortHeritageRestaurant.goodFor,
          address: fortHeritageRestaurant.address,
          nearby: fortHeritageRestaurant.nearby,
          dietaryTags: fortHeritageRestaurant.dietaryTags,
          budget: fortHeritageRestaurant.budget,
          premium: fortHeritageRestaurant.premium,
          menuCategories: fortHeritageRestaurant.menuCategories,
          reviewsPreview: fortHeritageRestaurant.reviewsPreview,
          mapQuery: fortHeritageRestaurant.mapQuery,
          coordinates: fortHeritageRestaurant.coordinates,
        },
      }
    );
  }

  const sahanaBeachRestaurant = seedRestaurants.find((restaurant) => restaurant.id === "sahanabeach");
  if (sahanaBeachRestaurant) {
    await Restaurant.updateOne(
      {
        id: sahanaBeachRestaurant.id,
        $or: [
          { hours: { $in: [null, ""] } },
          { vibe: { $in: [null, ""] } },
          { bestTime: { $in: [null, ""] } },
          { address: { $in: [null, ""] } },
          { "goodFor.0": { $exists: false } },
          { "menuCategories.main.0": { $exists: false } },
        ],
      },
      {
        $set: {
          name: sahanaBeachRestaurant.name,
          location: sahanaBeachRestaurant.location,
          price: sahanaBeachRestaurant.price,
          desc: sahanaBeachRestaurant.desc,
          hours: sahanaBeachRestaurant.hours,
          vibe: sahanaBeachRestaurant.vibe,
          bestTime: sahanaBeachRestaurant.bestTime,
          goodFor: sahanaBeachRestaurant.goodFor,
          address: sahanaBeachRestaurant.address,
          nearby: sahanaBeachRestaurant.nearby,
          dietaryTags: sahanaBeachRestaurant.dietaryTags,
          budget: sahanaBeachRestaurant.budget,
          premium: sahanaBeachRestaurant.premium,
          menuCategories: sahanaBeachRestaurant.menuCategories,
          reviewsPreview: sahanaBeachRestaurant.reviewsPreview,
          mapQuery: sahanaBeachRestaurant.mapQuery,
          coordinates: sahanaBeachRestaurant.coordinates,
        },
      }
    );
  }

  const mamasRestaurant = seedRestaurants.find((restaurant) => restaurant.id === "mamasbakery");
  if (mamasRestaurant) {
    await Restaurant.updateOne(
      { id: mamasRestaurant.id },
      {
        $set: {
          mapQuery: mamasRestaurant.mapQuery,
          coordinates: mamasRestaurant.coordinates,
        },
      }
    );
  }

  const fortHeritageCabin = seedRestaurants.find((restaurant) => restaurant.id === "fortheritagecabin");
  if (fortHeritageCabin) {
    await Restaurant.updateOne(
      { id: fortHeritageCabin.id },
      {
        $set: {
          mapQuery: fortHeritageCabin.mapQuery,
          coordinates: fortHeritageCabin.coordinates,
        },
      }
    );
  }

  const sahanaBeach = seedRestaurants.find((restaurant) => restaurant.id === "sahanabeach");
  if (sahanaBeach) {
    await Restaurant.updateOne(
      { id: sahanaBeach.id },
      {
        $set: {
          mapQuery: sahanaBeach.mapQuery,
          coordinates: sahanaBeach.coordinates,
        },
      }
    );
  }
};

const weatherCodeMap = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

const computeSummary = (restaurants) => {
  const overallScore =
    restaurants.length > 0
      ? Number(
          (restaurants.reduce((sum, item) => sum + item.aiScore, 0) / restaurants.length).toFixed(1)
        )
      : 0;

  const topRecommendation = restaurants[0]
    ? {
        id: restaurants[0].id,
        name: restaurants[0].name,
        aiScore: restaurants[0].aiScore,
        rankingScore: restaurants[0].rankingScore ?? restaurants[0].aiScore,
      }
    : null;

  return {
    overallScore,
    totalResults: restaurants.length,
    topRecommendation,
  };
};

const fetchScoredRestaurants = async ({
  location,
  price,
  minRating,
  search,
  maxDistanceKm,
  fromLocation,
  fromLat,
  fromLng,
}) => {
  await ensureSeedData();

  const query = {};

  if (location) {
    query.location = { $regex: location, $options: "i" };
  }

  if (price && price !== "Any") {
    const normalized = normalizePriceRange(price);
    const aliases = getPriceRangeAliases(normalized);
    query.price = aliases.length > 0 ? { $in: aliases } : normalized;
  }

  if (search) {
    const tokens = String(search)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .slice(0, 8);
    const pattern = tokens.length > 0 ? tokens.join("|") : String(search);

    query.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { location: { $regex: pattern, $options: "i" } },
      { vibe: { $regex: pattern, $options: "i" } },
      { desc: { $regex: pattern, $options: "i" } },
    ];
  }

  let restaurants = await Restaurant.find(query).lean();
  restaurants = await attachReviewMetrics(restaurants);

  const minRatingNumber = Number(minRating);
  if (Number.isFinite(minRatingNumber) && minRatingNumber > 0) {
    restaurants = restaurants.filter((restaurant) => Number(restaurant.rating || 0) >= minRatingNumber);
  }
  const parsedLat = Number(fromLat);
  const parsedLng = Number(fromLng);
  const hasProvidedCoordinates =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;
  const center = hasProvidedCoordinates
    ? { lat: parsedLat, lng: parsedLng }
    : await resolveLocationCenter(fromLocation);
  const distanceLimit = Number(maxDistanceKm);

  if (center && Number.isFinite(distanceLimit) && distanceLimit > 0) {
    restaurants = await Promise.all(
      restaurants.map(async (restaurant) => {
        let lat = toFiniteNumber(restaurant.coordinates?.lat);
        let lng = toFiniteNumber(restaurant.coordinates?.lng);
        let resolvedCoords = null;

        if (lat === null || lng === null) {
          const fallbackCenter = await resolveLocationCenter(restaurant.location);
          const fallbackLat = toFiniteNumber(fallbackCenter?.lat);
          const fallbackLng = toFiniteNumber(fallbackCenter?.lng);

          if (fallbackLat !== null && fallbackLng !== null) {
            lat = fallbackLat;
            lng = fallbackLng;
            resolvedCoords = { lat, lng };

            Restaurant.updateOne(
              { id: restaurant.id },
              { $set: { coordinates: resolvedCoords } }
            ).catch(() => {});
          }
        }

        if (lat === null || lng === null) {
          return { ...restaurant, distanceKm: null };
        }

        const distanceKm = haversineKm(center.lat, center.lng, lat, lng);

        return {
          ...restaurant,
          ...(resolvedCoords ? { coordinates: resolvedCoords } : {}),
          distanceKm: Number(distanceKm.toFixed(1)),
        };
      })
    );

    restaurants = restaurants
      .filter((restaurant) => restaurant.distanceKm !== null && restaurant.distanceKm <= distanceLimit)
      .sort((a, b) => a.distanceKm - b.distanceKm || b.rating - a.rating);
  } else { 
    restaurants.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  }

  const scoredRestaurants = restaurants.map((restaurant) =>
    buildScoredRestaurant(restaurant, {
      preferredPrice: price,
      search,
      maxDistanceKm: Number.isFinite(distanceLimit) ? distanceLimit : 0,
    })
  );

  scoredRestaurants.sort((a, b) => b.aiScore - a.aiScore || b.rating - a.rating);

  return {
    restaurants: scoredRestaurants,
    summary: computeSummary(scoredRestaurants),
  };
};

const parseChatQueryToFilters = (text) => {
  const q = (text || "").toLowerCase();
  const parsed = {
    location: "",
    fromLocation: "",
    price: "",
    minRating: 0,
    search: "",
    maxDistanceKm: 0,
    explanationParts: [],
  };

  if (q.includes("galle fort")) {
    parsed.location = "Galle Fort";
    parsed.fromLocation = "Galle Fort";
    parsed.explanationParts.push("location: Galle Fort");
  } else if (q.includes("unawatuna")) {
    parsed.location = "Unawatuna";
    parsed.fromLocation = "Unawatuna";
    parsed.explanationParts.push("location: Unawatuna");
  } else if (q.includes("tangalle")) {
    parsed.location = "Tangalle";
    parsed.fromLocation = "Tangalle";
    parsed.explanationParts.push("location: Tangalle");
  } else if (q.includes("mirissa")) {
    parsed.location = "Mirissa";
    parsed.fromLocation = "Mirissa";
    parsed.explanationParts.push("location: Mirissa");
  } else if (q.includes("weligama") || q.includes("waligama")) {
    parsed.location = "Weligama";
    parsed.fromLocation = "Weligama";
    parsed.explanationParts.push("location: Weligama");
  } else if (q.includes("ahangama")) {
    parsed.location = "Ahangama";
    parsed.fromLocation = "Ahangama";
    parsed.explanationParts.push("location: Ahangama");
  } else if (q.includes("galle")) {
    parsed.location = "Galle";
    parsed.fromLocation = "Galle";
    parsed.explanationParts.push("location: Galle");
  }

  if (q.includes("cheap") || q.includes("budget") || q.includes("low cost")) {
    parsed.price = "Budget";
    parsed.explanationParts.push("budget: Budget");
  } else if (q.includes("mid") || q.includes("moderate")) {
    parsed.price = "Moderate";
    parsed.explanationParts.push("budget: Moderate");
  } else if (q.includes("luxury")) {
    parsed.price = "Luxury";
    parsed.explanationParts.push("budget: Luxury");
  } else if (q.includes("premium") || q.includes("expensive")) {
    parsed.price = "Expensive";
    parsed.explanationParts.push("budget: Expensive");
  }

  const ratingMatch = q.match(/(\d(?:\.\d)?)\s*\+?/);
  if (ratingMatch && Number(ratingMatch[1]) <= 5) {
    parsed.minRating = Number(ratingMatch[1]);
    parsed.explanationParts.push(`min rating: ${parsed.minRating}+`);
  } else if (q.includes("top rated") || q.includes("best rated")) {
    parsed.minRating = 4.3;
    parsed.explanationParts.push("min rating: 4.3+");
  }

  const distanceMatch = q.match(/(\d+)\s*(km|kilometer|kilometers)/);
  if (distanceMatch) {
    parsed.maxDistanceKm = Number(distanceMatch[1]);
    parsed.explanationParts.push(`distance: within ${parsed.maxDistanceKm} km`);
  }

  const searchTerms = q
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term && !stopWords.has(term) && term.length > 2);
  parsed.search = searchTerms.join(" ");

  return parsed;
};

const tokenizeReviewText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const analyzeReviewText = (text) => {
  const tokens = tokenizeReviewText(text);
  if (tokens.length === 0) {
    return { sentimentLabel: "neutral", sentimentScore: 0, topics: [] };
  }

  const positiveCount = tokens.filter((token) => positiveLexicon.has(token)).length;
  const negativeCount = tokens.filter((token) => negativeLexicon.has(token)).length;
  const matchedSentimentWords = positiveCount + negativeCount;
  const rawScore =
    matchedSentimentWords > 0 ? (positiveCount - negativeCount) / matchedSentimentWords : 0;
  const sentimentScore = Number(rawScore.toFixed(2));

  let sentimentLabel = "neutral";
  if (sentimentScore >= 0.25) sentimentLabel = "positive";
  if (sentimentScore <= -0.25) sentimentLabel = "negative";

  const topics = Object.entries(topicLexicon)
    .filter(([, words]) => words.some((word) => tokens.includes(word)))
    .map(([topicName]) => topicName);

  return { sentimentLabel, sentimentScore, topics };
};

const mapReview = (review) => ({
  id: String(review._id),
  restaurantId: review.restaurantId,
  userId: String(review.userId),
  userName: review.userName,
  rating: Number(review.rating),
  comment: review.comment,
  sentimentLabel: review.sentimentLabel || "neutral",
  sentimentScore: Number(review.sentimentScore || 0),
  topics: Array.isArray(review.topics) ? review.topics : [],
  createdAt: review.createdAt,
});

const summarizeReviews = (reviews) => {
  const baseSummary = {
    totalReviews: reviews.length,
    averageRating: 0,
    averageSentiment: 0,
    sentimentCounts: {
      positive: 0,
      neutral: 0,
      negative: 0,
    },
    topicMentions: {
      food: 0,
      service: 0,
      price: 0,
      ambience: 0,
    },
  };

  if (reviews.length === 0) return baseSummary;

  let ratingTotal = 0;
  let sentimentTotal = 0;

  reviews.forEach((review) => {
    ratingTotal += Number(review.rating || 0);
    sentimentTotal += Number(review.sentimentScore || 0);

    const label = review.sentimentLabel || "neutral";
    if (baseSummary.sentimentCounts[label] !== undefined) {
      baseSummary.sentimentCounts[label] += 1;
    }

    (review.topics || []).forEach((topic) => {
      if (baseSummary.topicMentions[topic] !== undefined) {
        baseSummary.topicMentions[topic] += 1;
      }
    });
  });

  return {
    ...baseSummary,
    averageRating: Number((ratingTotal / reviews.length).toFixed(1)),
    averageSentiment: Number((sentimentTotal / reviews.length).toFixed(2)),
  };
};

exports.getRestaurantReviews = async (req, res) => {
  try {
    await ensureSeedData();
    const restaurant = await Restaurant.findOne({ id: req.params.id }).lean();
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(100, Math.floor(requestedLimit))
      : 50;

    const reviews = await Review.find({ restaurantId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const normalizedReviews = reviews.map(mapReview);
    return res.status(200).json({
      reviews: normalizedReviews,
      summary: summarizeReviews(normalizedReviews),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch reviews", error: error.message });
  }
};

exports.addRestaurantReview = async (req, res) => {
  try {
    await ensureSeedData();
    const restaurant = await Restaurant.findOne({ id: req.params.id }).lean();
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    if (comment.length < 5) {
      return res.status(400).json({ message: "Comment must be at least 5 characters long" });
    }

    if (comment.length > 500) {
      return res.status(400).json({ message: "Comment must be 500 characters or less" });
    }

    const fallbackAnalysis = analyzeReviewText(comment);
    let sentimentLabel = fallbackAnalysis.sentimentLabel;
    let sentimentScore = fallbackAnalysis.sentimentScore;
    const topics = fallbackAnalysis.topics;

    try {
      const prediction = await predictSentiment(comment);
      if (prediction?.label) sentimentLabel = prediction.label;

      if (Number.isFinite(prediction?.score)) {
        const probability = Math.max(0, Math.min(1, Number(prediction.score)));
        if (sentimentLabel === "positive") sentimentScore = Number(probability.toFixed(2));
        if (sentimentLabel === "neutral") sentimentScore = 0;
        if (sentimentLabel === "negative") sentimentScore = Number((-probability).toFixed(2));
      }
    } catch (_) {
      // Flask service unavailable; keep fallbackAnalysis.
    }
    const created = await Review.create({
      restaurantId: req.params.id,
      userId: req.user.id,
      userName: req.user.name || "Anonymous",
      rating,
      comment,
      sentimentLabel,
      sentimentScore,
      topics,
    });
    const updatedMetrics = await syncRestaurantReviewMetrics(req.params.id);

    return res.status(201).json({
      message: "Review submitted successfully",
      review: mapReview(created.toObject()),
      restaurantMetrics: updatedMetrics,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit review", error: error.message });
  }
};

exports.getRestaurants = async (req, res) => {
  try {
    const result = await fetchScoredRestaurants(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch restaurants", error: error.message });
  }
};

exports.getChatbotRecommendations = async (req, res) => {
  try {
    const queryText = String(req.body.query || "").trim();
    if (!queryText) {
      return res.status(400).json({ message: "Query is required" });
    }

    const parsed = parseChatQueryToFilters(queryText);
    const result = await fetchScoredRestaurants(parsed);
    const parsedSummary =
      parsed.explanationParts.length > 0
        ? `Applied ${parsed.explanationParts.join(", ")}`
        : "Showing best matches based on your request";

    const assistantMessage = await buildAssistantMessage({
      queryText,
      restaurants: result.restaurants,
      summary: result.summary,
      parsedSummaryText: `${parsedSummary}. Found ${result.summary.totalResults} restaurants.`,
    });

    return res.status(200).json({
      ...result,
      assistantMessage,
      parsedFilters: {
        location: parsed.location || "Any",
        price: parsed.price || "Any",
        minRating: parsed.minRating || 0,
        maxDistanceKm: parsed.maxDistanceKm || 0,
        search: parsed.search || "",
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to get chatbot recommendations",
      error: error.message,
    });
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    await ensureSeedData();
    const restaurant = await Restaurant.findOne({ id: req.params.id }).lean();

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const [restaurantWithMetrics] = await attachReviewMetrics([restaurant]);
    const scoredRestaurant = buildScoredRestaurant(restaurantWithMetrics || restaurant, {
      preferredPrice: null,
      search: "",
      maxDistanceKm: 0,
    });
    return res.status(200).json({ restaurant: scoredRestaurant });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch restaurant", error: error.message });
  }
};

exports.getRestaurantWeather = async (req, res) => {
  try {
    await ensureSeedData();
    const restaurant = await Restaurant.findOne({ id: req.params.id }).lean();

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    let lat = toFiniteNumber(restaurant.coordinates?.lat);
    let lng = toFiniteNumber(restaurant.coordinates?.lng);
    let fallbackUsed = false;

    if (lat === null || lng === null) {
      const center = await resolveLocationCenter(restaurant.location);
      if (center) {
        lat = toFiniteNumber(center.lat);
        lng = toFiniteNumber(center.lng);
        fallbackUsed = lat !== null && lng !== null;
      }

      if (fallbackUsed) {
        Restaurant.updateOne(
          { id: restaurant.id },
          { $set: { coordinates: { lat, lng } } }
        ).catch(() => {});
      }
    }

    if (lat === null || lng === null) {
      return res.status(400).json({ message: "Coordinates not available for weather" });
    }

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      "&current=temperature_2m,weather_code,wind_speed_10m,apparent_temperature,relative_humidity_2m" +
      "&timezone=auto";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    let response;
    try {
      response = await fetch(weatherUrl, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data.current) {
      return res.status(502).json({
        message: "Failed to fetch weather data",
        status: response.status,
      });
    }

    const code = data.current.weather_code;
    return res.status(200).json({
      weather: {
        temperatureC: data.current.temperature_2m,
        feelsLikeC: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        windSpeedKmh: data.current.wind_speed_10m,
        weatherCode: code,
        description: weatherCodeMap[code] || "Unknown",
        observedAt: data.current.time,
        source: fallbackUsed ? "locationCenter" : "restaurantCoordinates",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load weather", error: error.message });
  }
};


export const TAXONOMY: Record<string, Record<string, string[]>> = {
  top: {
    'T-Shirts': ['Crew Neck', 'V-Neck', 'Pocket Tee', 'Longline', 'Oversized', 'Fitted', 'Graphic', 'Polo', 'Henley', 'Other'],
    'Shirts': ['Oxford', 'Button-Down', 'Chambray', 'Flannel', 'Dress Shirt', 'Linen Shirt', 'Cuban Collar', 'Overshirt', 'Other'],
    'Blouses': ['Silk Blouse', 'Wrap Blouse', 'Peplum', 'Off-Shoulder', 'Tie-Front', 'Peasant', 'Balloon Sleeve', 'Other'],
    'Knitwear': ['Crewneck Sweater', 'V-Neck Sweater', 'Turtleneck', 'Mock Neck', 'Quarter-Zip', 'Half-Zip', 'Cardigan', 'Vest', 'Shrug', 'Other'],
    'Hoodies & Sweatshirts': ['Pullover Hoodie', 'Zip-Up Hoodie', 'Graphic Sweatshirt', 'Crewneck Sweatshirt', 'Oversized Hoodie', 'Other'],
    'Tanks & Camisoles': ['Tank Top', 'Camisole', 'Crop Top', 'Bralette', 'Tube Top', 'Spaghetti Strap', 'Muscle Tank', 'Other'],
    'Activewear Tops': ['Sports Bra', 'Compression Top', 'Performance Tee', 'Training Tank', 'Yoga Top', 'Other'],
    'Other': ['Other'],
  },
  bottom: {
    'Denim': ['Slim Fit', 'Straight Leg', 'Skinny', 'Relaxed Fit', 'Wide Leg', 'Bootcut', 'Flared', 'Cropped', 'Distressed', 'Other'],
    'Trousers': ['Slim Fit', 'Straight Leg', 'Pleated', 'Tapered', 'Relaxed', 'Wide Leg', 'Chinos', 'Dress Pants', 'Linen Trousers', 'Other'],
    'Shorts': ['Chino Shorts', 'Denim Shorts', 'Athletic Shorts', 'Board Shorts', 'Bermuda', 'Cargo Shorts', 'Biker Shorts', 'Other'],
    'Skirts': ['Mini Skirt', 'Midi Skirt', 'Maxi Skirt', 'A-Line', 'Pencil', 'Wrap Skirt', 'Pleated', 'Asymmetric', 'Other'],
    'Leggings & Tights': ['Full Length Leggings', 'Capri Leggings', 'High-Waist Leggings', 'Thermal Tights', 'Sheer Tights', 'Other'],
    'Sweatpants & Joggers': ['Slim Jogger', 'Relaxed Jogger', 'Cargo Jogger', 'French Terry Sweatpants', 'Tapered Sweatpants', 'Other'],
    'Activewear Bottoms': ['Running Shorts', 'Training Tights', 'Yoga Pants', 'Compression Shorts', 'Other'],
    'Other': ['Other'],
  },
  full_body: {
    'Dresses': ['Mini Dress', 'Midi Dress', 'Maxi Dress', 'Shift Dress', 'Wrap Dress', 'Slip Dress', 'A-Line Dress', 'Bodycon', 'Shirt Dress', 'Other'],
    'Jumpsuits': ['Wide Leg Jumpsuit', 'Slim Fit Jumpsuit', 'Strapless Jumpsuit', 'Utility Jumpsuit', 'Other'],
    'Rompers': ['Casual Romper', 'Denim Romper', 'Floral Romper', 'Linen Romper', 'Other'],
    'Suits': ['Single-Breasted', 'Double-Breasted', 'Three-Piece', 'Power Suit', 'Linen Suit', 'Other'],
    'Overalls': ['Bib Overalls', 'Shortalls', 'Dungaree Dress', 'Other'],
    'Other': ['Other'],
  },
  shoes: {
    'Sneakers': ['Low-Top', 'High-Top', 'Slip-On', 'Running', 'Training', 'Court', 'Platform', 'Dad Sneaker', 'Other'],
    'Boots': ['Chelsea', 'Ankle Boot', 'Combat Boot', 'Knee-High', 'Over-the-Knee', 'Desert Boot', 'Cowboy Boot', 'Hiking Boot', 'Chukka', 'Other'],
    'Loafers & Dress Shoes': ['Penny Loafer', 'Bit Loafer', 'Oxford', 'Derby', 'Monk Strap', 'Brogues', 'Mule', 'Other'],
    'Sandals': ['Slide', 'Flip Flop', 'Strappy Sandal', 'Platform Sandal', 'Birkenstock Style', 'Espadrille', 'Other'],
    'Heels': ['Stiletto', 'Block Heel', 'Wedge', 'Kitten Heel', 'Mule Heel', 'Pump', 'Other'],
    'Flats': ['Ballet Flat', "D'Orsay Flat", 'Mary Jane', 'Pointed Toe', 'Other'],
    'Athletic Shoes': ['Running Shoe', 'Trail Runner', 'Basketball Shoe', 'Cleats', 'Cycling Shoe', 'Other'],
    'Other': ['Other'],
  },
  outerwear: {
    'Jackets': ['Bomber', 'Denim Jacket', 'Leather Jacket', 'Moto Jacket', 'Track Jacket', 'Windbreaker', 'Field Jacket', 'Blazer', 'Other'],
    'Coats': ['Trench Coat', 'Wool Coat', 'Pea Coat', 'Overcoat', 'Chesterfield', 'Duffle Coat', 'Other'],
    'Puffer & Insulated': ['Puffer Jacket', 'Down Vest', 'Quilted Jacket', 'Parka', 'Puffer Coat', 'Other'],
    'Rainwear': ['Rain Jacket', 'Rain Coat', 'Waterproof Parka', 'Other'],
    'Fleece & Softshell': ['Fleece Jacket', 'Softshell Jacket', 'Pullover Fleece', 'Other'],
    'Vests': ['Down Vest', 'Puffer Vest', 'Utility Vest', 'Suit Vest', 'Other'],
    'Other': ['Other'],
  },
  accessory: {
    'Bags': ['Tote', 'Backpack', 'Crossbody', 'Shoulder Bag', 'Clutch', 'Belt Bag', 'Messenger Bag', 'Duffel', 'Other'],
    'Hats & Headwear': ['Baseball Cap', 'Beanie', 'Bucket Hat', 'Fedora', 'Beret', 'Snapback', 'Sun Hat', 'Visor', 'Other'],
    'Scarves & Wraps': ['Cashmere Scarf', 'Silk Scarf', 'Infinity Scarf', 'Blanket Scarf', 'Shawl', 'Other'],
    'Belts': ['Leather Belt', 'Canvas Belt', 'Woven Belt', 'Statement Belt', 'Other'],
    'Sunglasses': ['Wayfarer', 'Aviator', 'Round', 'Cat Eye', 'Oversized', 'Sport', 'Other'],
    'Jewelry': ['Necklace', 'Bracelet', 'Ring', 'Earrings', 'Anklet', 'Brooch', 'Other'],
    'Gloves & Mittens': ['Leather Gloves', 'Knit Gloves', 'Mittens', 'Fingerless Gloves', 'Other'],
    'Socks & Hosiery': ['Ankle Socks', 'Crew Socks', 'Knee-High Socks', 'No-Show Socks', 'Compression Socks', 'Tights', 'Stockings', 'Other'],
    'Other': ['Other'],
  },
  valuables: {
    'Watches': ['Dress Watch', 'Sport Watch', 'Tool Watch', 'Chronograph', 'Smartwatch', 'Dive Watch', 'Field Watch', 'Other'],
    'Fine Jewelry': ['Diamond', 'Gold', 'Silver', 'Gemstone', 'Pearl', 'Other'],
    'Wallets': ['Bifold Wallet', 'Trifold Wallet', 'Card Holder', 'Money Clip', 'Zip Wallet', 'Other'],
    'Sunglasses': ['Designer', 'Vintage', 'Limited Edition', 'Other'],
    'Other': ['Other'],
  },
};

export function getSubcategories(category: string): string[] {
  return Object.keys(TAXONOMY[category] ?? {});
}

export function getStyles(category: string, subcategory: string): string[] {
  return TAXONOMY[category]?.[subcategory] ?? [];
}

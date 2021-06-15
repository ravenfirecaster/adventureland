// Hey there!
// This is CODE, lets you control your character with code.
// If you don't know how to code, don't worry, It's easy.
// Just set attack_mode to true and ENGAGE!

// Write your own CODE: https://github.com/kaansoral/adventureland

/* ******************************* */
/*     Variables we can change     */
/* ******************************* */

// Do we want to allow combat?
var attack_mode = true;

// If we die and respawn, do we want to go back and keep fighting
// (and potentially keep dying...) or stay safe in town?
var fight_after_death = false;

// What type of monsters are we hunting today?
var farm_monster_stats = {
    type: 'bee',  // Name of the monster type to go looking for
    min_xp: 100,    // Don't waste mana on monsters not worth our time
    max_att: 200    // Don't attack anything too strong!
};

/* How fancy are we getting with our combat style? Our options include:
- basic: target a monster, get close, and start hitting (best for melee)
- circle: walk around in circles shooting (best for ranged)
- follow: attack whatever the leader of the party is attacking
- heal: heal the party first, then "follow" if no one needs healing
*/
var combat_style = {
    type: 'follow',  // Current options listed above
    radius: 75       // If circle, how far do we walk?
};

// What are we looking to buy when we get back into town?
var shopping_list = {
    mpot: {
        type: 'mpot1',
        min: 5,
        stack: 800
    },
    hpot: {
        type: 'hpot1',
        min: 5,
        stack: 800
    }
};

// What items are safe to sell when we get back into town?
// Make sure you edit this if you don't want to sell certain gear!
//var sell_whitelist = [ 'stinger', 'wshoes', 'wcap', 'wbreeches' ];
var sell_whitelist = [ 'stinger' ];

// How loud and noisy do we want the debug log to get?
// 0 - no logging
// 1 - important stuff that doesn't happen often (ex. dying, buying items)
// 2 - not-so-important stuff that might happen often (ex. drink a potion)
// 3 - debug-level (not recommended!)
var log_level = 1;

// How frequently (in milliseconds) do we want the loop to run? (1-2000)
// WARNING: setting the number too low may cause instability, including
// but not limited to your PC freezing or your account being disabled!
var interval = 100;

/* ********************* */
/*     Main function     */
/* ********************* */

setInterval(function(){
    // First, check to see if we're dead. If so, let's respawn, but
    // specify whether or not we want to 
    rfHandleRespawn(fight_after_death);

    // Check to see if we need to drink a potion
	rfHandleDrinkingPotions(shopping_list);

    // Grab da lootz!
	rfHandleLoot();

    // Make sure we have enough potions before we get ourselves in trouble...
    rfHandleShoppingRun(shopping_list);

    // Start fighting!
    rfHandleCombat(farm_monster_stats,combat_style);
},interval);

/* ****************************** */
/*     Custom functions below     */
/* ****************************** */

var last_respawn = new Date();
function rfHandleRespawn(keep_fighting) {
    // If we're dead *and* it's been at least 10 seconds since the last 
    // respawn attempt, try to respawn
    if (character.rip && mssince(last_respawn) > 10000) {
        rfLog(1,"Looks like we died - respawning now");
        respawn();

        // Record the respawn time
        last_respawn = new Date();

        // Don't let ourselves get stuck in a death-loop
        // (ie. thing kills us, respawn, head back to die again)
        if (!keep_fighting) attack_mode = false;
    }
}

function rfHandleDrinkingPotions(shopping_list) {
    // Don't drink anything if we're already dead!
    if (character.rip) return;

    // Define what type of potion we're drinking based on our shopping list
    var mpot_type = shopping_list.mpot.type;
    var hpot_type = shopping_list.hpot.type;

    // Figure out how much each type of potion actually gives us
    var mpot_gives = parent.G.items[mpot_type].gives[0][1];
    var hpot_gives = parent.G.items[hpot_type].gives[0][1];

    // First, let's address mana, only because without mana, we'll never be
    // able to attack and we'll just keep drinking HP pots until we run dry
    if (!is_on_cooldown('use_mp')) {
        // Make sure we can use our skill at least 5 times...
        if(character.mp < (character.mp_cost * 5)) {
            rfLog(2,"Drinking a mana potion...");
            use_skill('use_mp');
        } 
        // Make sure we don't waste any of the potion
        else {
            if (character.mp < (character.max_mp - mpot_gives)) {
                rfLog(2,"Drinking a mana potion...");
                use_skill('use_mp');
            }   
        }
    }

    // Next, check to see if we need to use a health potion
    if (!is_on_cooldown('use_hp')) {
        var low_hp = character.max_hp - hpot_gives;

        // If we're in a party with a healer, give the healer a chance 
        // to heal us...
        if (character.party){
            var have_healer = false;

            // Loop through the party members
            for (var member_name in parent.party) {
                // Did we find ourself?
                if (member_name == character.name) continue;

                var member = parent.entities[member_name];

                // Is the party member out of range?
                if (!member || !member.visible) continue;

                // Is this party member a healer?
                if (member.ctype == 'priest') {
                    have_healer = true;
                    continue;
                }
            }

            // If we do have a healer, only pop a healing potion ourselves
            // if we run desperately low...
            low_hp = hpot_gives * 2;
        }

        // Make sure we don't waste any of the potion
        if (character.hp < low_hp) {
            rfLog(2,"Drinking a health potion...");
            use_skill('use_hp');
        }   
    }
}

function rfHandleLoot() {
    // Well, this is pretty straight-forward...
    loot();
}

function rfHandleCombat(monster_info,style) {
    // Hop out right away if we're not in attack-mode
    if (!attack_mode) return;

    // Don't try and attack if we're dead or in the middle of moving
    if (character.rip || is_moving(character) || smart.moving) return;

    // Are we looking for a special combat style?
    if (style) {
        // Circle attack
        if (style.type == 'circle') {
            rfAttackMonsterCircling(monster_info,style);
        }
        // Follow-the-leader attack
        else if (style.type == 'follow') {
            rfAttackMonsterFollowing(monster_info,style);
        }
        // Heal-first then attack
        else if (style.type == 'heal') {
            rfAttackMonsterHealing(monster_info,style);
        }
        // Basic attack
        else {
            rfAttackMonsterBasic(monster_info);
        }
    }
    else {
        rfAttackMonsterBasic(monster_info);
    }
}

function rfAcquireMonsterTarget(monster_info) {
    // Set some baseline attributes for the type of monster we're 
    // looking to target
    var min_xp = (monster_info.min_xp) ? monster_info.min_xp : 100;
    var max_att = (monster_info.max_att) ? monster_info.max_att : 120;
    var monster_type = (monster_info.type) ? monster_info.type : null;

    var monster_attributes = {
        type: monster_type,
        min_xp: min_xp,
        max_att: max_att,
        path_check: true
    }

    // First, try and grab a monster that's targetting us
    monster_attributes.target = character;
    var target = get_nearest_monster(monster_attributes);
    
    // Did we come up empty?
    if (!target) {
        // Take another shot, this time looking for any old
        // target that someone else hasn't already aggroed
        monster_attributes.target = null;
        monster_attributes.no_target = true;

        target = get_nearest_monster(monster_attributes);

        // Did we still come up empty? Give up...
        if (!target) return;
    }

    // We found a target! Lock onto it and return
    rfLog(3,"Target acquired!")
    change_target(target);

    return target;
}

function rfMoveTowardsMonsterTarget(target) {
    // Figure out how far away we are from the target
    var current_dist = parent.distance(character,target);

    // We want to move as little to the target as possible.
    // First, find the halfway point between us and the target.
    var half_x = character.x + (target.x - character.x) / 2;
    var half_y = character.y + (target.y - character.y) / 2;

    // Is the halfway distance still going to be out of range?
    // If so, let's at least move halfway there and try again later
    if (current_dist / 2 > character.range) {
        move(half_x, half_y);
    }
    else {
        // Keep adding half to the proposed distance until we get out of range
        var proposed_dist = current_dist / 2;
        var proposed_x = half_x;
        var proposed_y = half_y;

        var close_enough = false;
        while (!close_enough) {
            proposed_dist += (current_dist - proposed_dist) / 2;

            // Did we overshoot our range?
            if (proposed_dist > character.range) {
                // We're close enough then. Exit the loop
                close_enough = true;
            }
            // Are we moving less than 1 unit away? Close enough!
            else if (current_dist - proposed_dist < 1) {
                close_enough = true;
            }
            // Otherwise, keep on adding half to the proposed move
            else {
                proposed_x = character.x + (proposed_x - character.x) / 2;
                proposed_y = character.y + (proposed_y - character.y) / 2;
            }
        }

        // Good, now we know where we're going! Let's move there
        move(proposed_x,proposed_y);
    }
}

function rfMoveTowardsPartyMember(target) {
    // Figure out how far away we are from the target
    var current_dist = parent.distance(character,target);

    // If we can't figure out the distance, we're lost! Wait in place
    // and hope our party member returns
    if (!current_dist) return;

    // No need to do anything if we're already within range (attack or
    // heal) of our target
    if (character.range / 1.5 > current_dist) return;

    // Since we're not in range, rather than shuffling inch by inch
    // forever, we want to move close enough to our target to be
    // within half of our max range. First, find the halfway point 
    // between us and the target.
    var half_x = character.x + (target.x - character.x) / 2;
    var half_y = character.y + (target.y - character.y) / 2;

    // Is this going to get us close enough?
    if (current_dist / 2 <= character.range) {
        rfLog(3,"Moving closer to leader");
        move(half_x, half_y);
    }
    else {
        // Keep adding half to the proposed distance until we get into range
        var proposed_dist = current_dist / 2;
        var proposed_x = half_x;
        var proposed_y = half_y;

        var close_enough = false;
        while (!close_enough) {
            proposed_dist -= (current_dist - proposed_dist) / 2;

            // Are we within range now?
            if (proposed_dist <= character.range) {
                // We're close enough then. Exit the loop
                close_enough = true;
            }
            // Are we moving less than 1 unit away? Close enough!
            else if (current_dist - proposed_dist < 1) {
                close_enough = true;
            }
            // Otherwise, keep on adding half to the proposed move
            else {
                proposed_x = character.x + (proposed_x - character.x) / 2;
                proposed_y = character.y + (proposed_y - character.y) / 2;
            }
        }

        // Good, now we know where we're going! Let's move there
        rfLog(3,"Moving closer to leader");
        move(proposed_x,proposed_y);
    }
}

function rfAttackMonsterBasic(monster_info) {
    // Don't try to attack if we're dead or smart-mmoving
    if (character.rip || smart.move) return;

    // See if we're currently targeting anything
    var target = get_targeted_monster();

    // Are we targeting anything?
	if (!target) {
        // Try and lock onto a new target
        target = rfAcquireMonsterTarget(monster_info);

        // Did we lock onto a new monster?
		if (!target) {
            // Do we have a type of monster we're looking for? Go to a new
            // area and search for them if so
            if (monster_info.type) {
                set_message("Seeking target");
                rfSmartMove(monster_info.type);
            }

            // Hop out now and let other stuff happen
			return;
		}
	}
	
    // Now that we have a target, are we close enough to start attacking?
    if (is_in_range(target)) {
        // Make sure we can actually attack the target (ex. not stunned)
        if(can_attack(target)) {
            set_message("Attacking");

            // For this, just fire a basic attack
            attack(target);
        }
    }
    // If it's too far away... CHAAAAARGE!
	else {
        rfMoveTowardsMonsterTarget(target);
	}

}

var move_circle = { };
function rfAttackMonsterCircling(monster_info,style) {
    // Don't do anything if we're already in motion
    if (is_moving(character) || smart.move) return;

    // If we don't know anything about our circle yet and we're done moving,
    // let's initialize our circle to where we're standing now
    if (!Object.entries(move_circle).length) {
        var x = character.real_x;
        var y = character.real_y;

        rfLog(2,"Initializing our circle at: (" + x + "," + y + ")");
        move_circle = rfInitializeMoveCircle(style.radius,36,x,y);
    }

     // See if we're currently targeting anything
    var target = get_targeted_monster();

    // Are we targeting anything?
	if (!target) {
        // Try and lock onto a new target
        rfLog(3,"Acquiring a new target...");
        target = rfAcquireMonsterTarget(monster_info);

        // Did we lock onto a new monster?
		if (!target) {
            // Do we have a type of monster we're looking for? Go to a new
            // area and search for them if so
            if (monster_info.type) {
                // Wipe out our circle info but don't initialize until 
                // we're done moving
                move_circle = { };

                set_message("Seeking target");
                rfSmartMove(monster_info.type);
            }
			return;
		}
	}
	
    // Now that we have a target, are we close enough to start attacking?
    if (is_in_range(target)) {
        // Fire off a basic attack if we can
        if(can_attack(target)) {
            set_message("Circling");
            attack(target);
        }
    }
    
    // Take the nextstep in the circle
    rfMoveInCircle(move_circle);
}

function rfAttackMonsterFollowing(monster_info,style) {
    // If we're not in a party, default to either a basic or circling
    // attack based on our character's range
    if (!character.party) {
        // If we can shoot, try and circle
        if (character.range > 50) {
            rfAttackMonsterCircling(monster_info,style);
        }
        // Otherwise, just face-tank
        else {
            rfAttackMonsterBasic(monster_info);
        }
        return;
    }

    // Identify our party leader
    var leader = parent.entities[character.party];
    
    // First, make sure we can actually see our leader!
    if (!leader || !leader.visible) {
        // Sit patiently until the leader returns
        set_message("Waiting on " + character.party);
        rfLog(2,"Waiting on leader to get back in range");
        return;
    }

    // Make sure we're standing close enough to our leader
    rfMoveTowardsPartyMember(leader);

    // Make sure we're not moving...
    if (!is_moving(character)) {
        // Does our leader have a target?
        if (leader.target) {
            // Identify the target
            var target = parent.entities[leader.target];

            // Don't move from our leader, but see if we can attack his target
            if (is_in_range(target) && can_attack(target)) {
                // Make sure we don't have aggro!
                if (target.target && target.target != character.name) {
                    attack(target);
                }
            }
        }
    }
}

function rfAttackMonsterHealing(monster_info,style) {
    // First things first, see if we need to toss out a heal
    rfHealParty();

    // Otherwise, act like were following someone else
    rfAttackMonsterFollowing(monster_info,style);
}

function rfHealParty() {
    // NOTE: the amount we heal is the same as a basic "attack"
    var heal_amt = character.attack;

    // Determine who we're going to heal
    var heal_target = null;

    // If we're not in a party, then we're the only possible target
    if (!character.party) {
        // Check to see if we need a heal
        if (character.max_hp - character.hp >= heal_amt) {
            heal_target = character;
        }
    }
    else {
        // We're going to want to heal the party member with the least HP left
        var hp_left = 0;

        // Loop through the party members
        for (var member_name in parent.party) {
            var member;
            
            // Did we find ourself?
            if (member_name == character.name) {
                member = character;
            }
            else {
                member = parent.entities[member_name];
            }

            // If we're too far away from the party member, bomb out
            if (!member) continue;

            // Check to see if this member needs a heal
            if (member.max_hp - member.hp >= heal_amt) {
                // Do we already have a target to heal
                if (heal_target) {
                    // Is our current party member worse off than our target?
                    if (member.hp < hp_left) {
                        // This member is our new "best" target
                        heal_target = member;
                        hp_left = member.hp;
                    }
                }
                // Otherwise, this is the current "best" target
                else {
                    heal_target = member;
                    hp_left = member.hp;
                }
            }
        }
    }

    // Did we identify someone who needs a heal?
    if (!heal_target) return;

    // Great, let's try and heal the target (still based on "attack" timer)
    if (can_heal(heal_target)) {
        rfLog(2,"Healing " + heal_target.name);
        heal(heal_target);
    }
}

function rfHandleShoppingRun(shopping_list,force_trip) {
    // Don't start making a trip back to town if we're dead
    // or if we're already smart-moving somewhere
    if (character.rip || smart.moving) return;

    // Only shop if we need to and we're not forcing it
    // (force is usually for testing only...)
    if (!rfNeedToShop(shopping_list) && !force_trip) return;
    rfLog(3,'Making a shopping run');

    // Keep track of where we are now
    var location = rfWhereAmI();

    // Head back to town if we're not already there yet
    if (location.real_x || location.real_y) rfSmartMove('town',true);

    // See if we can compound any items to a higher level
    //    rfHandleCompoundItems();

    // Sell off extraneous loots
    rfSellCrapLoot(sell_whitelist);

    // Buy enough potions to top off a stack
    rfBuyPotions(shopping_list);

    // Go back to where we started
    rfSmartMove(location);
}

function rfNeedToShop(shopping_list) {
    // Go home if we're low on mana potions
    var mpots_owned = quantity(shopping_list.mpot.type);
    if (mpots_owned < shopping_list.mpot.min) return true;

    // Go home if we're low on health potions
    var hpots_owned = quantity(shopping_list.hpot.type);
    if (hpots_owned < shopping_list.hpot.min) return true;

    // Go home if our inventory is full
    if (character.esize < 2) return true;

    // Haven't found a reason to go home yet!
    return false;
}

function rfSellCrapLoot(whitelist) {
    // Loop through all our inventory slots
    for (var i in character.items) {
        var slot = character.items[i];

        // Is there something in that inventory slot?
        if (slot != null) {
            // Only sell off items we've whitelisted!
            if (whitelist && whitelist.includes(slot.name)) {
                // Make sure it's not high quality!
                if (item_grade(slot) > 0) {
                    // Okay, should be safe to sell now...!
                    rfLog(1,"Selling item: " + slot.name);
                    sell(i, 9999);
                }
            }
        }
    }
}

function rfBuyPotions(shopping_list) {
    // Figure out what type of each potion we need to buy
    var mpot_type = 'mpot0';
    var hpot_type = 'hpot0';
    if (shopping_list) {
        mpot_type = shopping_list.mpot.type;
        hpot_type = shopping_list.hpot.type;
    }

    // Figure out how big a stack we want to end up with
    var mpot_stack = 200;
    var hpot_stack = 200;
    if (shopping_list) {
        mpot_stack = shopping_list.mpot.stack;
        hpot_stack = shopping_list.hpot.stack;
    }

    // How many do we need to buy to fill a stack?
    var mpots_need = mpot_stack - quantity(mpot_type);
    var hpots_need = hpot_stack - quantity(hpot_type);

    // Do we actually need to buy anything? Bomb out if not
    if (!mpots_need && !hpots_need) return;

    // Keep track of where we are now
    var location = rfWhereAmI();

    // Head to the potion vendor
    rfSmartMove('potions',true);

    // Buy enough mana potions to top off a stack
    if (mpots_need > 0) {
        rfLog(1,"Buying " + mpots_need + " " + mpot_type);
        buy_with_gold(mpot_type, mpots_need);
    }
    
    // Buy enough health potions to top off a stack
    if (hpots_need > 0) {
        rfLog(1,"Buying " + hpots_need + " " + hpot_type);
        buy_with_gold(hpot_type, hpots_need);
    }

    // Go back to where we started
    rfSmartMove(location);
}

function rfBuyScrolls(shopping_list) {
    // Do a quick sanity-check to see if we actually need to buy anything...
    var need_to_buy = false;
    for (var scroll_name in shopping_list) {
        if (shopping_list[scroll_name] > 0) need_to_buy = true;
    }
    if (!need_to_buy) return;

    // Keep track of where we are now
    var location = rfWhereAmI();

    // Move to the scroll vendor
    rfSmartMove('scrolls',true);

    // Loop through each type of scroll
    for (var scroll_name in shopping_list) {
        var scrolls_need = shopping_list[scroll_name];

        if (scrolls_need > 0) {
            rfLog(1,"Buying " + scrolls_need + " " + scroll_name);
            buy_with_gold(scroll_name, scrolls_need);
        }
    }

    // Go back to where we started
    rfSmartMove(location);
}

function rfHandleCompoundItems() {
    // See if we have any compoundable items in our inventory
    var compoundables = rfFindCompoundableItemsInInventory();

    // Keep track of how many of each type of scroll we'll need
    var scrolls_to_buy = {
        cscroll0: 0,
        cscroll1: 0,
        cscroll2: 0
    };

    // And figure out what it is we'll actually compound
    var compound_list = [ ];

    // Figure out exactly which slots we're going to attempt to compound
    for (var item_name in compoundables) {
        for (var item_level in compoundables[item_name]) {
            // How many items do we have
            var num_have = compoundables[item_name][item_level].count;

            // How many items of this type do we need to compound?
            var num_to_compound = 3;

            // Do we have at least that many?
            if (num_have >= num_to_compound) {
                // Round down to the nearest whole number how many times
                // we're going to perform a compound
                var combos = floor(num_have / num_to_compound);

                // Figure out what type of scroll we need to buy to upgrade
                // this type of item
                
                /*** FIX THIS ***/
                var item_grade = 'cscroll0';

                // Add this to the number of scrolls we need to buy
                scrolls_to_buy[item_grade] += combos;

                // Loop through the list of compoundables, grab even sets of
                // them, and store them as batches to be compounded
                for (var i = 0 ; i < combos ; i++) {
                    // Push the type of scroll as the first item used
                    // in the combo set
                    var combo_set = [ item_grade ];

                    // Loop through each of the compoundable items we're going
                    // to use to compound in this set
                    for (var j = 0 ; j < num_to_compound ; j++) {
                        // Determine the index of this item in the set
                        var item_idx = (i * num_to_compound) + j;

                        // Grab the slot for this item in our inventory
                        var inventory_idx = compoundables[item_name][item_level].locations[item_idx];

                        // Push the slot onto the end of the combo set
                        combo_set.push(inventory_idx)
                    }

                    // Finally, add the combo set to the list of things
                    // we're going to compound
                    compound_list.push(combo_set);
                }
            }
        }
    }

    // At this point, our compound_list should contain a list of combo "sets".
    // Each "set" has the name of a scroll, followed by the positions in our
    // inventory of the items to be compounded. If we haven't found anything, 
    // though, we can bomb out safely now
    if (!compound_list.length) return;
    rfLog(2,"Ready to compound " + compound_list.length + " items");

    // Loop through each of the scrolls and see if we have what we need
    // in inventory already
    for (var scroll_name in scrolls_to_buy) {
        var scrolls_owned = quantity(scroll_name);
        var scrolls_need = scrolls_to_buy[scroll_name];

        // Update the "shopping list" to reflect what we don't already have
        if (scrolls_need > scrolls_owned) {
            scrolls_to_buy[scroll_name] = scrolls_need - scrolls_owned;
        }
        else {
            scrolls_to_buy[scroll_name] = 0;
        }
    }

    // Go shopping for the scrolls we need
    rfBuyScrolls(scrolls_to_buy);

    // Keep track of where we are now
    var location = rfWhereAmI();

    // Move to the compound vendor
    rfSmartMove('compound',true);

    // Loop through each compound set
    for (var compound_set of compound_list) {
        // Figure out where the scroll is
        var scroll_idx = locate_item(compound_set[0]);

        // Make sure we really did buy enough...
        if (scroll_idx) {
            // Grab the 3 items to be compounded
            var item1 = compound_set[1];
            var item2 = compound_set[2];
            var item3 = compound_set[3];

            // Compound the 3 items
            rfLog(1,"Compounding items: " + item1 + "," + item2 + "," + item3);
            compound(item1,item2,item3,scroll_idx);
        }
    }

    // Go back to where we started
    rfSmartMove(location);
}

function rfFindCompoundableItemsInInventory() {
    // Define a list of items that can be compounded
    var compoundables = { };
    var found_one = false;

    // Loop through our inventory slots looking for compoundable items
    for (var i in character.items) {
        var slot = character.items[i];

        // Is there something in that inventory slot?
        if (slot != null) {
            var item_name = slot.name;
            var item_level = slot.level;

            // Is it compoundable?
            if (parent.G.items[item_name].compound) {
                // Store and record the item. Note: you can only compound items
                // of the same level, so we need to track that too!
                rfLog(3,"Found compoundable item " + item_name + " in slot " + i);
                
                // Is this the first time we're seeing this item?
                if (!compoundables[item_name]) {
                    // Create the initial data object
                    compoundables[item_name] = { };

                    compoundables[item_name][item_level] = {
                        count: 1,
                        locations: [ i ]
                    }
                }
                else if (!compoundables[item_name][item_level]) {
                    compoundables[item_name][item_level] = {
                        count: 1,
                        locations: [ i ]
                    }
                }
                // How about the item at this level?
                else {
                    // Add 1 to the hit count
                    compoundables[item_name][item_level].count ++;

                    // Add the location of thie item in our inventory 
                    // to the end of the list
                    compoundables[item_name][item_level].locations.push(i);
                }

                // Record that we've found at least one compoundable item
                found_one = true;
            }
        }
    }

    // Return what we've found, if anything
    if (found_one) return compoundables;
    else return null;
}

/* ************************* */
/*     Utility functions     */
/* ************************* */

// Handle custom logging to the console
function rfLog(level,message) {
    // Make sure the user wants to see messages of this level
    if (log_level < level) return;

    // Build the date prefix
    var date = new Date();
    var prefix = "[" + date.toLocaleDateString() + 
                 " " + date.toLocaleTimeString() + "] ";

    console.log(prefix + message);
}

// Return a location object, suitable to be used with smart_move
function rfWhereAmI() {
    var loc = {
        x: character.real_x,
        y: character.real_y,
        map: character.map
    };

    return loc;
}

// Custom smart_move function, relying heavily on the original but which
// allows for a multi-step move. (ex. move to town, then to multiple 
// different shops, before moving back to the start)
function rfSmartMove(destination,not_done) {
    // If we're already moving, don't move again
    if (smart.moving) return;

    // If we weren't given a destination to move to, exit
    if (!destination) return;

    var target_name = '';

    // Were we given a name or number to move to?
    if (is_string(destination) || is_number(destination)) {
        target_name = destination;
    }
    // Or were we given coordinates?
    else if (x in destination) {
        target_name = '(' + destination.x + ',' + destination.y + ')';
    }
    // Or how about a "to" parameter?
    else if (to in destination) {
        target_name = destination.to;
    }
    // I have no idea what to do now...
    else {
        return;
    }

    // Log the move
    rfLog(1,"RF-moving towards: " + target_name);

    // Store the move
    character.rf_moving = target_name;

    // Smart-move towards the destination
    smart_move(destination, function() {
        // Only unset the moving variable if we're done moving to our
        // final destination
        if (!not_done) character.rf_moving = null;
    });
}

function rfInitializeMoveCircle(r,step,x,y) {
    // Check to see if we were given a start point
    if (!y || !is_number(y)) y = character.real_y;
    if (!x || !is_number(x)) x = character.real_x;

    // Check if we were given a "step"-size 
    // (number of steps to take around a 360-degree circle)
    if (!step || !is_number(step) || step > 360) step = 36;

    // Make sure we were given a reasonable radius to walk
    if (!r || !is_number(r) || r >= 1000) r = 50;

    // Record this info in a new circle object
    var circle = {
        start_x: x,
        start_y: y,
        radius: r,
        step: step,
        idx: null,
        positions: [ ]
    };

    // Determine how far in radians we're walking around the circle
    var theta = (360 / step) * (Math.PI / 180);

    // First, seed the array of positions with the 12 o'clock position
    circle.positions.push( [ x, y - r ] );

    // Keep walking around the circle from the 12 o'clock position
    for (var i = 1; i < step; i++) {
        // Figure out where we actually are on the circle
        var cur_x = circle.positions[i - 1][0];
        var cur_y = circle.positions[i - 1][1];

        // Figure out where we would be if the center of our
        // circle had been at (0,0)
        var relative_x = cur_x - x;
        var relative_y = cur_y - y;

        // Hard maths based on the relative coordinates...
        var relative_new_x = (relative_x * Math.cos(theta)) + 
                             (relative_y * Math.sin(theta));
        var relative_new_y = (relative_y * Math.cos(theta)) - 
                             (relative_x * Math.sin(theta));

        // Adjust back to our actual absolute location
        var new_x = relative_new_x + x;
        var new_y = relative_new_y + y;

        // And add the new location onto the array
        circle.positions.push( [ new_x, new_y ] );
    }

    // Return the new circle object
    return circle;
}

function rfMoveInCircle(circle) {
    // Can't move if we weren't given a circle with valid points...
    if (!Object.entries(circle).length || !circle.positions) return;

    // If we haven't moved yet, jump to the 12 o'clock position
    if (circle.idx == null) {
        circle.idx = 0;
    }
    else {
        // Figure out what the next index should be
        if (circle.idx >= circle.positions.length - 1) {
            circle.idx = 0;
        }
        else {
            circle.idx ++;
        }
    }

    // Grab the coordinates from the new index
    var x = circle.positions[circle.idx][0];
    var y = circle.positions[circle.idx][1];

    // Move to the new position on the circle
    move(x,y);
}
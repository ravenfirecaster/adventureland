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

// What type of monsters are we hunting today?
var farm_monster_stats = {
    type: 'tortoise',
    min_xp: 100,
    max_att: 120
};

// What are we looking to buy when we get back into town?
var shopping_list = {
    mpot: {
        type: 'mpot0',
        min: 5,
        stack: 200
    },
    hpot: {
        type: 'hpot0',
        min: 5,
        stack: 200
    }
};

// What items are safe to sell when we get back into town?
var sell_whitelist = [];

/* ********************* */
/*     Main function     */
/* ********************* */

setInterval(function(){
    // First, check to see if we're dead. If so, let's respawn
    rfHandleRespawn();

    // Check to see if we need to drink a potion
    var mpot_gives = parent.G.items.mpot0.gives[0][1];
    var hpot_gives = parent.G.items.hpot0.gives[0][1];
	rfHandlePotions(mpot_gives,hpot_gives);

    // Grab da lootz!
	loot();

    // If we're in the process of moving manually, bomb out
	if(is_moving(character)) return;

    // Make sure we have enough potions before we get ourselves in trouble...
    rfHandleShoppingRun(false);

    // Start fighting!
    if (attack_mode) rfHandleCombat(farm_monster_stats);

},250); // Loops every 1/4 seconds.

/* ****************************** */
/*     Custom functions below     */
/* ****************************** */

var last_respawn = new Date();
function rfHandleRespawn(keep_fighting) {
    // If we're dead *and* it's been at least 10 seconds since the last 
    // respawn attempt, try to respawn
    if (character.rip && mssince(last_respawn) > 10000) {
        console.log("Looks like we're dead - respawning now")
        respawn();

        // Record the respawn time
        last_respawn = new Date();

        // Don't let ourselves get stuck in a death-loop
        // (ie. thing kills us, respawn, head back to die again)
        if (!keep_fighting) attack_mode = false;
    }
}

function rfHandlePotions(mpot_gives,hpot_gives) {
    // Don't drink anything if we're already dead!
    if (character.rip) return;

    // First, let's address mana, only because without mana, we'll never be
    // able to attack and we'll just keep drinking HP pots until we run dry
    if (!is_on_cooldown('use_mp')) {
        // Make sure we can use our skill at least 5 times...
        if(character.mp < (character.mp_cost * 5)) {
            console.log("Drinking a mana potion...");
            use_skill('use_mp');
        } 
        // Make sure we don't waste any of the potion
        else {
            if (character.mp < (character.max_mp - mpot_gives)) {
                console.log("Drinking a mana potion...");
                use_skill('use_mp');
            }   
        }
    }
    // Next, check to see if we need to use a health potion
    if (!is_on_cooldown("use_hp")) {
        // Make sure we don't waste any of the potion
        if (character.hp < (character.max_hp - hpot_gives)) {
            console.log("Drinking a health potion...");
            use_skill('use_hp');
        }   
    }
}

function rfHandleCombat(monster_info) {
    // See if we're currently targeting anything
    var target = get_targeted_monster();

    // Are we targeting anything? Get a target if not
	if(!target)	{
        target = rfAcquireMonsterTarget(monster_info);
		
        // Did we find a monster?
        if(target) {
            // Great! Target the monster
            console.log("Target acquired!")
            change_target(target);
        }
		else {
			set_message("No monsters - moving to a new location...");

            // Do we have a type of monster we're looking for? Go to a new
            // area and search for them if so
            if (monster_info.type && !smart.moving) {
                console.log("Smart-moving towards: " + monster_info.type);
                smart_move(monster_info.type);
            }
			return;
		}
	}
	
    // Are we close enough to start attacking?
    if (is_in_range(target)) {
        rfHandleAttackMonsterTarget(target);
    }
    // If it's too far away... CHAAAAARGE!
	else {
        rfMoveTowardsMonsterTarget(target);
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
        no_target: true,
        path_check: true
    }

    // Grab the nearest monster as a target based on those attributes
    var target = get_nearest_monster(monster_attributes);
    
    // Did we find a monster?
    if(target) {
        // Great! Target the monster and return it
        change_target(target);
        return target;
    }
    else {
        return null;
    }
}

function rfMoveTowardsMonsterTarget(target) {
    // Figure out how far away we are from the target
    var current_dist = parent.distance(character,target);

    // We want to move as little to the target as possible.
    // First, find the halfway point between us and the target.
    var half_x = character.x + (target.x - character.x) / 2;
    var half_y = character.y + (target.y - character.y) / 2;

    // Figure out how far away the halfway point would be from the target
    //var half_dist = Math.sqrt( (target.x - half_x) ^ 2 + 
    //                           (target.y - half_y) ^ 2 );
    //

    // Is the halfway distance still going to be out of range?
    // If so, let's at least move halfway there and try again later
    if (current_dist / 2 > character.range) {
        move(half_x, half_y);
    }
    else {
        // Let's adding half to the proposed distance until we get out of range
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

function rfHandleAttackMonsterTarget(target) {
    if(can_attack(target)) {
		set_message("Attacking");
		attack(target);
    }
}

function rfHandleShoppingRun(go_back) {
    // First, let's see if we need to go home yet...
    var go_shop = false;

    var mpots_owned = quantity(shopping_list.mpot.type);
    var hpots_owned = quantity(shopping_list.hpot.type);

    // Do we have enough mana pots?
    if (mpots_owned < shopping_list.mpot.min) go_shop = true;
    // How about health pots?
    else if (hpots_owned < shopping_list.hpot.min) go_shop = true;
    // Is our inventory full?
    else if (character.esize < 2) go_shop = true;

    // Okay... do we need to shop? Hop out if not
    if (!go_shop) return;

    // First, let's keep track of where we are now
    var x = character.real_x;
    var y = character.real_y;
    var map = character.map;

    // Head to the shopping area
    if (!smart.moving) smart_move('potions');

    // Sell off extraneous loots
    rfSellCrapLoot();

    // Buy enough potions to top off a stack
    rfBuyPotions();

    // See if we want to head back home
    if (go_back && !smart.moving) {
        smart_move({x:x,y:y,map:map});
    }
}

function rfSellCrapLoot() {
    // Loop through all our inventory slots
    for (var i in character.items) {
        var slot = character.items[i];

        // Is there something in that inventory slot?
        if (slot != null) {
            // Only sell off items we've whitelisted!
            if (sell_whitelist.includes(slot.name)) {
                console.log("Selling item: " + i);
                
                /* MAKE SURE ITEM ISN'T "SHINY" */
                
                //sell(i, 9999); 
            }
        }
    }
}

function rfBuyPotions() {
    var mpots_owned = quantity(shopping_list.mpot.type);
    var hpots_owned = quantity(shopping_list.hpot.type);

    // Buy enough mana potions to top off a stack
    var mpots_need = shopping_list.mpot.stack - mpots_owned;
    if (mpots_need > 0) {
        console.log("Buying " + mpots_need + "mpots")
        buy_with_gold(shopping_list.mpot.type, mpots_need);
    }
    
    // Buy enough health potions to top off a stack
    var hpots_need = shopping_list.hpot.stack - hpots_owned;
    if (hpots_need > 0) {
        console.log("Buying " + hpots_need + "hpots")
        buy_with_gold(shopping_list.hpot.type, hpots_need);
    }
}

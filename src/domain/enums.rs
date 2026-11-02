use serde::{Deserialize, Serialize};
use std::fmt;

macro_rules! string_enum {
    ($name:ident { $($variant:ident => $value:literal),* $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Deserialize, Serialize)]
        pub enum $name {
            $(#[serde(rename = $value)] $variant),*
        }

        impl $name {
            pub const fn as_str(self) -> &'static str {
                match self {
                    $(Self::$variant => $value),*
                }
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(self.as_str())
            }
        }
    };
}

string_enum!(ClassTier {
    Starter => "starter",
    Tier1 => "tier-1",
    Tier2 => "tier-2",
    Tier3 => "tier-3",
    Tier4 => "tier-4",
    Ultimate => "ultimate",
});

string_enum!(ClassRole {
    Main => "main",
    Sub => "sub",
});

string_enum!(Role {
    Dps => "dps",
    Tank => "tank",
    Healer => "healer",
    Specialist => "specialist",
});

string_enum!(Stat {
    Str => "str",
    Dex => "dex",
    Con => "con",
    Mnd => "mnd",
    Int => "int",
    Luk => "luk",
    Jmp => "jmp",
    Agl => "agl",
    Def => "def",
    Res => "res",
    Nrg => "nrg",
    For => "for",
});

impl Stat {
    pub const MAIN: [Stat; 6] = [
        Stat::Str,
        Stat::Dex,
        Stat::Con,
        Stat::Mnd,
        Stat::Int,
        Stat::Luk,
    ];
    pub const BONUS: [Stat; 6] = [
        Stat::Jmp,
        Stat::Agl,
        Stat::Def,
        Stat::Res,
        Stat::Nrg,
        Stat::For,
    ];
}

string_enum!(ModifierTarget {
    MaxHp => "max-hp",
    Str => "str",
    Dex => "dex",
    Con => "con",
    Mnd => "mnd",
    Int => "int",
    Luk => "luk",
    Jmp => "jmp",
    Agl => "agl",
    Def => "def",
    Res => "res",
    Nrg => "nrg",
    For => "for",
    Range => "range",
    Damage => "damage",
    MagicDamage => "magic-damage",
    MeleeDamage => "melee-damage",
    RestoreHp => "restore-hp",
    DamageTaken => "damage-taken",
});

string_enum!(GearSlot {
    MainHand => "main-hand",
    Armor => "armor",
    OffHand => "off-hand",
    Accessory => "accessory",
    Item => "item",
    Consumable => "consumable",
    Tool => "tool",
    Currency => "currency",
});

string_enum!(EquipmentSlot {
    MainHand => "main-hand",
    Armor => "armor",
    OffHand => "off-hand",
});

string_enum!(DamageType {
    None => "none",
    Slashing => "slashing",
    Piercing => "piercing",
    Bludgeoning => "bludgeoning",
});

string_enum!(PassiveSource {
    Ancestry => "ancestry",
    Background => "background",
    Class => "class",
});

string_enum!(PassiveSlot {
    NonCombat => "non-combat",
    Combat => "combat",
});

string_enum!(ActionType {
    Main => "main",
    Support => "support",
    Reaction => "reaction",
});

string_enum!(RequirementKind {
    Constant => "constant",
    WellRested => "well-rested",
    ClassAdept => "class-adept",
    NonCombat => "non-combat",
    InCombat => "in-combat",
    ClassLevel => "class-level",
    PartyLevel => "party-level",
    OncePerRound => "once-per-round",
    OncePerCombat => "once-per-combat",
    Reaction => "reaction",
    AttackedWhileArmed => "attacked-while-armed",
    TargetApproaches => "target-approaches",
    AttackedInRange => "attacked-in-range",
    Attacked => "attacked",
    Exposed => "exposed",
    Damaged => "damaged",
    FailedCheckNearby => "failed-check-nearby",
    TargetLeaves => "target-leaves",
});

impl RequirementKind {
    pub const fn is_leveled(self) -> bool {
        matches!(self, Self::ClassLevel | Self::PartyLevel)
    }
}

string_enum!(PrerequisiteKind {
    Class => "class",
    AnyStarter => "any-starter",
});

string_enum!(MaxHpMode {
    Normal => "normal",
    DoubleCon => "double-con",
});

string_enum!(StatShape {
    Square => "square",
    Circle => "circle",
    Star => "star",
    DiamondPip => "diamond-pip",
});

string_enum!(StatShapeMeaning {
    Permanent => "permanent",
    Temporary => "temporary",
    Class => "class",
    PartyLevel => "party-level",
});

string_enum!(StatusKind {
    Boon => "boon",
    Condition => "condition",
    Dot => "dot",
    State => "state",
    Other => "other",
});

string_enum!(DataStatus {
    Placeholder => "placeholder",
    Partial => "partial",
    Complete => "complete",
});

string_enum!(Expertise {
    Strength => "strength",
    Bravado => "bravado",
    ThrowCatch => "throw-catch",
    Constitution => "constitution",
    Concentration => "concentration",
    Resistance => "resistance",
    Intelligence => "intelligence",
    Crafting => "crafting",
    Knowledge => "knowledge",
    Dexterity => "dexterity",
    Stealth => "stealth",
    Thievery => "thievery",
    Mind => "mind",
    Nature => "nature",
    Perception => "perception",
    Luck => "luck",
    Charisma => "charisma",
    Deception => "deception",
    Any => "any",
});

string_enum!(Language {
    Common => "common",
    Egrhandi => "egrhandi",
    Enattish => "enattish",
    Halthketan => "halthketan",
    Khanadurian => "khanadurian",
    Lagosian => "lagosian",
    Litooran => "litooran",
    Maulawian => "maulawian",
    Nethander => "nethander",
    Orinotisian => "orinotisian",
    Skrii => "skrii",
    Uhhrantian => "uhhrantian",
});

string_enum!(VisionType {
    Normal => "normal",
    LowLight => "low-light",
    Dark => "dark",
    Binocular => "binocular",
});

string_enum!(TierUnlockSource {
    AnyStarter => "any-starter",
    Tier4 => "tier-4",
});

string_enum!(StarStatsRule {
    FollowMainClass => "follow-main-class",
});

string_enum!(EquipmentRule {
    MainClassOnly => "main-class-only",
});

string_enum!(SubclassAbilityRule {
    RightSideOnly => "right-side-only",
});

string_enum!(SubclassPassiveRule {
    UnlockedOnly => "unlocked-only",
});

string_enum!(UnlockMode {
    Manual => "manual",
});

string_enum!(ClassLevelSource {
    GmAwards => "gm-awards",
});

string_enum!(StarFill {
    Expertise => "expertise",
    LockedPassives => "locked-passives",
});

string_enum!(ReactionMode {
    ConditionTriggered => "condition-triggered",
});

string_enum!(XGrowth {
    PartyLevel => "party-level",
});

string_enum!(Allowance {
    Allowed => "allowed",
    Disallowed => "disallowed",
});

string_enum!(StartingItemsSource {
    Background => "background",
});

string_enum!(StartingGearFallback {
    BackgroundStartingItems => "background-starting-items",
    ManualInventoryEntry => "manual-inventory-entry",
});

string_enum!(StatusFallback {
    FreeTextStatuses => "free-text-statuses",
});

string_enum!(ShardSource {
    SpecificPartyLevels => "specific-party-levels",
    GmDiscretion => "gm-discretion",
});

string_enum!(ShardUse {
    InsideAndOutsideCombat => "inside-and-outside-combat",
});

string_enum!(InheritancePeriod {
    WeekStart => "week-start",
});

string_enum!(GoldEffectFrequency {
    OncePerEnemy => "once-per-enemy",
    PerEnemy => "per-enemy",
});

string_enum!(HybridMaxHp {
    LowerOfParents => "lower-of-parents",
});

impl ModifierTarget {
    pub const fn as_stat(self) -> Option<Stat> {
        match self {
            Self::MaxHp => None,
            Self::Str => Some(Stat::Str),
            Self::Dex => Some(Stat::Dex),
            Self::Con => Some(Stat::Con),
            Self::Mnd => Some(Stat::Mnd),
            Self::Int => Some(Stat::Int),
            Self::Luk => Some(Stat::Luk),
            Self::Jmp => Some(Stat::Jmp),
            Self::Agl => Some(Stat::Agl),
            Self::Def => Some(Stat::Def),
            Self::Res => Some(Stat::Res),
            Self::Nrg => Some(Stat::Nrg),
            Self::For => Some(Stat::For),
            Self::Range
            | Self::Damage
            | Self::MagicDamage
            | Self::MeleeDamage
            | Self::RestoreHp
            | Self::DamageTaken => None,
        }
    }
}

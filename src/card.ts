import { LovelaceCardConfig } from "custom-card-helpers";``
import { html, LitElement } from 'lit';
import { CARD_TYPE, INTEGRATION } from "./consts"
import { styles } from "./styles";

import { HomeAssistant2, Dictionary, Entity, relativeDate } from "./helpers"


export interface SimplePlantCardConfig extends LovelaceCardConfig {
  device: string;
}

export class SimplePlantCard extends LitElement {

    // properties
    private _hass : HomeAssistant2;

    // reactive
    private _device_id: string;
    private _translations_loaded: boolean = false;
    private _states_updated: boolean = true ;

    // other private
    private _device_name: string;
    private _entity_ids: Dictionary<string> = {} ;
    private _entity_states: Map<string, Entity> = new Map() ;
    private _config_updated: boolean = true ;
    private _translations : Dictionary<string> = {
        "button": "Mark as Watered !",
        "button_fertilized": "Mark as Fertilized !",
        "cancel": "Cancel",
        "today": "today"
    }

    static keys : Array<string> = [
        "mark_watered",
        "mark_fertilized",
        "todo",
        "problem",
        "problem_fertilization",
        "last_watered",
        "last_fertilized",
        "picture",
        "days_between_waterings",
        "health",
        "next_watering",
        "next_fertilization",
    ]

    set hass(hass : HomeAssistant2) {
        // Triggered everytime a state change and more
        this._hass = hass
        this._update_entites()
    }

    // Reactive properties, a change on one of those triggers a re-render
    static properties = {
        _device_id: { type: String, state: true },
        _translations_loaded: { type: Boolean, state: true },
        _states_updated: {
            type: Boolean,
            state: true,
            hasChanged(newVal: boolean, _oldVal: boolean){
                return newVal // Only re-render if _states_updated is true
            }
        }
    };

    static styles =  styles;

    setConfig(config : SimplePlantCardConfig) {
        // Triggers everytime the config of the card change
        if (!config.device) {
            throw new Error("You need to define a name");
        }
        this._device_id = config.device;
        // while editing the entity in the card editor
        if (this._hass) {
            this.hass = this._hass
        }
        this._config_updated = true;
    }

    _moreInfo(entity_key: string){
        const event = new CustomEvent("hass-more-info", {
            bubbles: true,
            composed: true,
            detail: {
                entityId: this._entity_ids[entity_key],
                view: 'info',
            }
        });


        this.dispatchEvent(event);
    }

    _navigateToDevice(deviceId: string) {
        window.history.pushState(null, "", `/config/devices/device/${deviceId}`);
        window.dispatchEvent(new Event("location-changed"));
    }

    // Create card and its content
    render() {
        if(this._config_updated) {
            // Re fetching device specific information
            this._get_friendly_name();
            this._fetch_entities();
            this._config_updated = false;
        }
        // Updating states
        if(!this._entity_states.size)
            this._update_entites()
        this._states_updated = false; // resetting for future use
        this._loadTranslations()

        // Guard: bail out if required entities are not yet loaded
        const requiredKeys = ["health", "days_between_waterings", "next_watering", "problem", "last_watered"];
        if (requiredKeys.some(k => !this._entity_states.get(k)))
            return html``;

        // compute strings
        const health_key_prefix = "component.simple_plant.entity.select.health.state"
        const health_key = `${health_key_prefix}.${this._entity_states.get("health").state}`
        const health = this._hass.localize(health_key)
        const healthColor = this._entity_states.get("health").attributes.color

        const days_between_label = this._entity_states.get("days_between_waterings").attributes.friendly_name
        const days_between_value = parseInt(this._entity_states.get("days_between_waterings").state)

        const local = this._hass.language
        const next_date = this._entity_states.get("next_watering").state;
        const today = this._translations["today"];
        const next_watering = relativeDate(next_date, local, today);
        const watering_can_color = this._entity_states.get("next_watering").attributes.color

        const late = this._entity_states.get("problem").state === "on";
        const next_watering_class = late ? "sub" : "";
        const late_class = late ? "" : "hidden";

        const last_date = this._entity_states.get("last_watered").state;
        const last_watered = relativeDate(last_date, local, today)
        const button_label = last_watered === today ? this._translations["cancel"] : this._translations["button"]

        const fertilization_enabled = !!this._entity_ids["next_fertilization"];
        let next_fertilization_class = "";
        let late_fertilization_class = "hidden";
        let fertilization_color = "";
        let next_fertilization = "";
        let button_fertilized_label = "";
        if (fertilization_enabled) {
            const next_fertilization_date = this._entity_states.get("next_fertilization").state;
            next_fertilization = relativeDate(next_fertilization_date, local, today);
            fertilization_color = this._entity_states.get("next_fertilization").attributes.color;

            const late_fertilization = this._entity_states.get("problem_fertilization").state === "on";
            next_fertilization_class = late_fertilization ? "sub" : "";
            late_fertilization_class = late_fertilization ? "" : "hidden";

            const last_fertilized_date = this._entity_states.get("last_fertilized").state;
            const last_fertilized = relativeDate(last_fertilized_date, local, today)
            button_fertilized_label = last_fertilized === today ? this._translations["cancel"] : this._translations["button_fertilized"]
        }

        // return card
        return html`
            <ha-card>
                <div class="card-content">
                    <div class="img-header"></div>
                        <hui-image
                            .hass=${this._hass}
                            .entity=${this._entity_ids["picture"]}
                            .fitMode=${"cover"}
                            @click="${() => this._moreInfo("picture")}"
                        ></hui-image>
                        <ha-icon-button
                            .label=${days_between_label}
                            @click="${() => this._moreInfo("days_between_waterings")}"
                        >
                            <ha-icon
                                data-days="${days_between_value}"
                                .icon=${"mdi:calendar-blank"
                            }></ha-icon>
                        </ha-icon-button>
                    </div>
                    <div class="info">
                        <h1 @click="${() => this._navigateToDevice(this._device_id)}">
                            ${this._device_name}
                        </h1>
                        <div class="row">
                            <ha-icon
                                data-color
                                style="--color: ${watering_can_color};"
                                .icon=${"mdi:watering-can"}
                            ></ha-icon>
                            <div class="content" @click="${() => this._moreInfo("last_watered")}">
                                <p class="${late_class}">${this._translations["late"]} !</p>
                                <p class="${next_watering_class}">${next_watering}</p>
                            </div>
                        </div>
                        <div class="row">
                            <ha-icon
                                .icon=${"mdi:heart-pulse"}
                                data-color
                                style="--color: ${healthColor};"
                            ></ha-icon>
                            <div class="content" @click="${() => this._moreInfo("health")}">
                                <p>${health}</p>
                            </div>
                        </div>

                        ${fertilization_enabled ? html`
                        <div class="row">
                            <ha-icon
                                data-color
                                style="--color: ${fertilization_color};"
                                .icon=${"mdi:sprout"}
                            ></ha-icon>
                            <div class="content" @click="${() => this._moreInfo("last_fertilized")}">
                                <p class="${late_fertilization_class}">${this._translations["late_fertilization"]} !</p>
                                <p class="${next_fertilization_class}">${next_fertilization}</p>
                            </div>
                        </div>
                        ` : ""}

                        <ha-button
                            @click="${this._handleButton}"
                        >${button_label}</ha-button>

                        ${fertilization_enabled ? html`
                        <ha-button
                            @click="${this._handleFertilizedButton}"
                        >${button_fertilized_label}</ha-button>
                        ` : ""}
                    </div>
                </div>
            </ha-card>
        `;
    }


    static getConfigElement() {
        // Create and return an editor element for UI card edition
        return document.createElement(`${CARD_TYPE}-editor`);
    }

    getCardSize() {
        return 10;
    }

    // The rules for sizing your card in the grid in sections view
    // https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/#sizing-in-sections-view
    getGridOptions() {
        return {
            columns: 6,
            min_columns: 6,
            max_columns: 9,
            min_rows: 8,
            max_rows: 8,
        };
    }

    // Specific to Simple Plant

    _handleButton() {
        this._hass.callService("button", "press", {}, {entity_id: this._entity_ids["mark_watered"]})
    }

    _handleFertilizedButton() {
        this._hass.callService("button", "press", {}, {entity_id: this._entity_ids["mark_fertilized"]})
    }

    _update_entites() {
        // Update values of entities that got updated
        var trigger_update = false;
        if (!this._entity_ids || !this._hass)
            return
        for (const [key, id] of Object.entries(this._entity_ids)) {
            const state = this._hass.states[id];
            if (!state) continue;

            if (
                (!this._entity_states.has(key))
                || (this._entity_states.get(key).state != state.state)
            ) {
                trigger_update = true
            }
            this._entity_states.set(key, state)
        }
        if(trigger_update)
            this._states_updated = true
    }

    _get_friendly_name() {
        if(!this._device_id || !this._hass)
            return
        const device = Object.values(this._hass.devices).find(
            (device) => device.id == this._device_id
        );

        if (device)
            this._device_name = device.name;
        else
            throw new Error("Couldn't find selected device");
    }

    _fetch_entities() {
        // Get entities from given device
        if(!this._device_id || !this._hass)
            return
        const entities = Object.values(this._hass.entities)
        const device_entities = entities.filter((entity) => entity.device_id == this._device_id);
        const entity_ids = device_entities.map(({entity_id}) => (entity_id))
        // parse entities
        // Sort keys by length descending so more specific keys match before shorter ones
        // (e.g. "problem_fertilization" before "problem")
        const sortedKeys = [...SimplePlantCard.keys].sort((a, b) => b.length - a.length);
        entity_ids.forEach(id => {
            for (const key of sortedKeys) {
                if (id.includes(key)) {
                    this._entity_ids[key] = id;
                    break;
                }
            }
        });
    }


    async _loadTranslations(){
        if (!this._entity_states.size || this._translations_loaded)
            return
        const translation_key = `component.${INTEGRATION}.entity.button.mark_watered.name`
        this._translations["button"] = `${this._hass.localize(translation_key)} !`
        const fertilized_key = `component.${INTEGRATION}.entity.button.mark_fertilized.name`
        this._translations["button_fertilized"] = `${this._hass.localize(fertilized_key)} !`
        this._translations["cancel"] = this._hass.localize("ui.dialogs.generic.cancel")
        this._translations["today"] = this._hass.localize("ui.components.calendar.today")
        this._translations["late"] = this._hass.localize(`component.${INTEGRATION}.entity.binary_sensor.problem.name`)
        this._translations["late_fertilization"] = this._hass.localize(`component.${INTEGRATION}.entity.binary_sensor.problem_fertilization.name`)
        this._translations_loaded = true
    }
}

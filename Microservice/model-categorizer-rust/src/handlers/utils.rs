use std::collections::HashMap;
use std::cmp::Ordering;
use crate::models::{Model as InternalModel, HierarchicalModelGroup as InternalHierarchicalModelGroup};
use crate::proto::modelservice::{Model as ProtoModel, ClassificationProperty as ProtoClassificationProperty, HierarchicalModelGroup as ProtoHierarchicalModelGroup, ClassifiedModelGroup as ProtoClassifiedModelGroup};
use crate::models::ClassificationProperty;
use crate::classifiers::{
    PROVIDER_OPENAI, PROVIDER_ANTHROPIC, PROVIDER_GEMINI,
    TYPE_FLASH_LITE, TYPE_FLASH, TYPE_PRO, TYPE_THINKING, TYPE_GEMMA, TYPE_STANDARD,
    TYPE_MINI, TYPE_O, TYPE_45, TYPE_4, TYPE_35, TYPE_SONNET, TYPE_OPUS, TYPE_HAIKU
};

/// Converts proto models to internal models
pub fn convert_proto_models_to_internal(proto_models: &[ProtoModel]) -> Vec<InternalModel> {
    proto_models.iter().map(|pm| InternalModel {
        id: pm.id.clone(),
        name: if pm.name.is_empty() { None } else { Some(pm.name.clone()) },
        context_size: pm.context_size,
        max_tokens: pm.max_tokens,
        provider: pm.provider.clone(),
        original_provider: Some(pm.provider.clone()),
        display_name: if pm.display_name.is_empty() { None } else { Some(pm.display_name.clone()) },
        description: if pm.description.is_empty() { None } else { Some(pm.description.clone()) },
        cost_per_token: pm.cost_per_token,
        capabilities: pm.capabilities.clone(),
        family: if pm.family.is_empty() { None } else { Some(pm.family.clone()) },
        model_type: if pm.r#type.is_empty() { None } else { Some(pm.r#type.clone()) },
        series: if pm.series.is_empty() { None } else { Some(pm.series.clone()) },
        variant: if pm.variant.is_empty() { None } else { Some(pm.variant.clone()) },
        is_default: pm.is_default,
        is_multimodal: pm.is_multimodal,
        is_experimental: pm.is_experimental,
        version: if pm.version.is_empty() { None } else { Some(pm.version.clone()) },
        metadata: pm.metadata.clone(),
    }).collect()
}

/// Converts internal models to proto models
pub fn convert_internal_models_to_proto(internal_models: &[InternalModel]) -> Vec<ProtoModel> {
    internal_models.iter().map(|im| ProtoModel {
        id: im.id.clone(),
        name: im.name.clone().unwrap_or_default(),
        context_size: im.context_size,
        max_tokens: im.max_tokens,
        provider: im.provider.clone(),
        display_name: im.display_name.clone().unwrap_or_default(),
        description: im.description.clone().unwrap_or_default(),
        cost_per_token: im.cost_per_token,
        capabilities: im.capabilities.clone(),
        family: im.family.clone().unwrap_or_default(),
        r#type: im.model_type.clone().unwrap_or_default(),
        series: im.series.clone().unwrap_or_default(),
        variant: im.variant.clone().unwrap_or_default(),
        is_default: im.is_default,
        is_multimodal: im.is_multimodal,
        is_experimental: im.is_experimental,
        version: im.version.clone().unwrap_or_default(),
        metadata: im.metadata.clone(),
    }).collect()
}

/// Converts classification properties to proto properties
pub fn convert_to_proto_properties(props: &[crate::models::ClassificationProperty]) -> Vec<ProtoClassificationProperty> {
    props.iter().map(|p| ProtoClassificationProperty {
        name: p.name.clone(),
        display_name: p.display_name.clone().unwrap_or_default(),
        description: p.description.clone().unwrap_or_default(),
        possible_values: p.possible_values.clone(),
    }).collect()
}

/// Checks if `slice` contains any of the `values`
pub fn contains_any(slice: &[String], values: &[String]) -> bool {
    slice.iter().any(|item| values.iter().any(|v| v == item))
}

/// Converts internal hierarchical group to proto hierarchical group
pub fn convert_internal_hierarchical_group_to_proto(
    internal_group: &InternalHierarchicalModelGroup,
) -> ProtoHierarchicalModelGroup {
    let models = convert_internal_models_to_proto(&internal_group.models);
    let mut group = ProtoHierarchicalModelGroup {
        group_name: internal_group.group_name.clone(),
        group_value: internal_group.group_value.clone(),
        models,
        children: Vec::new(),
    };
    for child in &internal_group.children {
        group.children.push(convert_internal_hierarchical_group_to_proto(child));
    }
    group
}

/// Converts proto hierarchical group to internal hierarchical group
pub fn convert_proto_hierarchical_group_to_internal(
    proto_group: &ProtoHierarchicalModelGroup,
) -> InternalHierarchicalModelGroup {
    let internal_models = convert_proto_models_to_internal(&proto_group.models);
    let mut group = InternalHierarchicalModelGroup {
        group_name: proto_group.group_name.clone(),
        group_value: proto_group.group_value.clone(),
        models: internal_models,
        children: Vec::new(),
    };
    for child in &proto_group.children {
        group.children.push(convert_proto_hierarchical_group_to_internal(child));
    }
    group
}

/// Categorize context window size
pub fn categorize_context_window(size: i32) -> String {
    match size {
        0..=10000 => "Small (< 10K)".to_string(),
        10001..=100000 => "Medium (10K-100K)".to_string(),
        100001..=200000 => "Large (100K-200K)".to_string(),
        _ => "Very Large (> 200K)".to_string(),
    }
}

/// Convert boolean to Yes/No
pub fn bool_to_yes_no(value: bool) -> String {
    if value { "Yes".to_string() } else { "No".to_string() }
}

/// Filter models based on criteria
pub fn filter_models_by_criteria(
    models_list: &[InternalModel],
    criteria: &crate::proto::modelservice::ClassificationCriteria,
) -> Vec<InternalModel> {
    models_list.iter().cloned().filter(|model| {
        if criteria.min_context_size > 0 && model.context_size < criteria.min_context_size {
            return false;
        }
        if !criteria.include_experimental && model.is_experimental {
            return false;
        }
        if !criteria.include_deprecated {
            if let Some(depr) = model.metadata.get("deprecated") {
                if depr == "true" {
                    return false;
                }
            }
        }
        true
    }).collect()
}

/// Sort models by provider, type (with special rules), version, then name
pub fn sort_models(models_list: &mut [InternalModel]) {
    // Provider priority map
    // Order: gemini < openai < openrouter < anthropic/claude < others
    let provider_priority: HashMap<&str, i32> = [
        ("gemini", 0),
        ("openai", 1),
        ("openrouter", 2),
        ("anthropic", 3),
        ("claude", 3),
    ].iter().cloned().collect();

    // Type priority maps for each provider
    let gemini_type_priority: HashMap<&str, i32> = [
        (TYPE_FLASH_LITE, 0),
        (TYPE_FLASH, 1),
        (TYPE_PRO, 2),
        (TYPE_THINKING, 3),
        (TYPE_GEMMA, 4),
        (TYPE_STANDARD, 5),
    ].iter().cloned().collect();
    let openai_type_priority: HashMap<&str, i32> = [
        (TYPE_MINI, 0),
        (TYPE_O, 1),
        (TYPE_45, 2),
        (TYPE_4, 3),
        (TYPE_35, 4),
        ("other", 5),
    ].iter().cloned().collect();
    let claude_type_priority: HashMap<&str, i32> = [
        (TYPE_SONNET, 0),
        (TYPE_OPUS, 1),
        (TYPE_HAIKU, 2),
        ("other", 3),
    ].iter().cloned().collect();

    models_list.sort_by(|a, b| {
        // Normalize provider
        let pa = a.provider.to_lowercase();
        let pb = b.provider.to_lowercase();
        let pr_a = *provider_priority.get(pa.as_str()).unwrap_or(&100);
        let pr_b = *provider_priority.get(pb.as_str()).unwrap_or(&100);
        if pr_a != pr_b {
            return pr_a.cmp(&pr_b);
        }

        // Extract types
        let ta = a.model_type.clone().unwrap_or_else(|| TYPE_STANDARD.to_string());
        let tb = b.model_type.clone().unwrap_or_else(|| TYPE_STANDARD.to_string());

        // Special: OpenAI mini series ordering
        if pa == "openai"
            && ta.to_lowercase() == TYPE_MINI.to_lowercase()
            && tb.to_lowercase() == TYPE_MINI.to_lowercase()
        {
            let na = a.name.clone().unwrap_or_else(|| a.id.clone()).to_lowercase();
            let nb = b.name.clone().unwrap_or_else(|| b.id.clone()).to_lowercase();
            fn mini_prio(name: &str) -> i32 {
                if name == "4o-mini" || name == "gpt-4o-mini" { 0 }
                else if name == "o1-mini" || name == "gpt-o1-mini" { 1 }
                else if name.contains("4o-mini") { 2 }
                else if name.contains("o1-mini") { 3 }
                else { 4 }
            }
            let ma = mini_prio(&na);
            let mb = mini_prio(&nb);
            if ma != mb { return ma.cmp(&mb); }
            // Compare version descending
            let va = a.version.clone().unwrap_or_default()
                .chars().filter(|c| c.is_digit(10) || *c == '.').collect::<String>()
                .parse::<f64>().unwrap_or(0.0);
            let vb = b.version.clone().unwrap_or_default()
                .chars().filter(|c| c.is_digit(10) || *c == '.').collect::<String>()
                .parse::<f64>().unwrap_or(0.0);
            if (va - vb).abs() > f64::EPSILON {
                return vb.partial_cmp(&va).unwrap_or(Ordering::Equal);
            }
            return na.cmp(&nb);
        }

        // Provider-specific type priority
        if pa == "gemini" {
            let ra = *gemini_type_priority.get(ta.as_str()).unwrap_or(&gemini_type_priority[TYPE_STANDARD]);
            let rb = *gemini_type_priority.get(tb.as_str()).unwrap_or(&gemini_type_priority[TYPE_STANDARD]);
            if ra != rb { return ra.cmp(&rb); }
        } else if pa == "openai" {
            let ra = *openai_type_priority.get(ta.as_str()).unwrap_or(&openai_type_priority["other"]);
            let rb = *openai_type_priority.get(tb.as_str()).unwrap_or(&openai_type_priority["other"]);
            if ra != rb { return ra.cmp(&rb); }
            // GPT-4 special ordering
            if ta == TYPE_4 && tb == TYPE_4 {
                let na = a.name.clone().unwrap_or_else(|| a.id.clone()).to_lowercase();
                let nb = b.name.clone().unwrap_or_else(|| b.id.clone()).to_lowercase();
                let ba = (na == "gpt-4o" || na == "4o");
                let bb = (nb == "gpt-4o" || nb == "4o");
                if ba != bb { return bb.cmp(&ba); }
                let va = na.contains("4o") && !na.contains("4o-mini");
                let vb = nb.contains("4o") && !nb.contains("4o-mini");
                if va != vb { return vb.cmp(&va); }
            }
            // "other" category shortest name first
            if ra == openai_type_priority["other"] && rb == openai_type_priority["other"] {
                let la = a.name.clone().unwrap_or_else(|| a.id.clone()).len();
                let lb = b.name.clone().unwrap_or_else(|| b.id.clone()).len();
                return la.cmp(&lb);
            }
        } else if pa == "anthropic" || pa == "claude" {
            let ra = *claude_type_priority.get(ta.as_str()).unwrap_or(&claude_type_priority["other"]);
            let rb = *claude_type_priority.get(tb.as_str()).unwrap_or(&claude_type_priority["other"]);
            if ra != rb { return ra.cmp(&rb); }
        }

        // Version descending
        let va = a.version.clone().unwrap_or_default()
            .chars().filter(|c| c.is_digit(10) || *c == '.').collect::<String>()
            .parse::<f64>().unwrap_or(0.0);
        let vb = b.version.clone().unwrap_or_default()
            .chars().filter(|c| c.is_digit(10) || *c == '.').collect::<String>()
            .parse::<f64>().unwrap_or(0.0);
        if (va - vb).abs() > f64::EPSILON {
            return vb.partial_cmp(&va).unwrap_or(Ordering::Equal);
        }

        // Final: name
        let na = a.name.clone().unwrap_or_else(|| a.id.clone()).to_lowercase();
        let nb = b.name.clone().unwrap_or_else(|| b.id.clone()).to_lowercase();
        na.cmp(&nb)
    });
}

/// Classify models by a given property into proto groups
pub fn classify_models_by_property(
    models_list: &[InternalModel],
    property: &str,
) -> Vec<ProtoClassifiedModelGroup> {
    let mut groups: HashMap<String, Vec<&InternalModel>> = HashMap::new();
    for model in models_list {
        let mut values = Vec::new();
        match property {
            "provider" => values.push(model.provider.clone()),
            "family" => if let Some(f) = model.family.clone() { values.push(f) },
            "type" => if let Some(t) = model.model_type.clone() { values.push(t) },
            "series" => if let Some(s) = model.series.clone() { values.push(s) },
            "variant" => if let Some(v) = model.variant.clone() { values.push(v) },
            "capability" => {
                for cap in &model.capabilities {
                    values.push(cap.clone());
                }
            }
            "context_window" => values.push(categorize_context_window(model.context_size)),
            "multimodal" => values.push(bool_to_yes_no(model.is_multimodal)),
            _ => continue,
        }
        for val in values {
            if !val.is_empty() {
                groups.entry(val.clone()).or_default().push(model);
            }
        }
    }
    let mut result = Vec::new();
    for (value, models) in groups {
        let proto_models = super::utils::convert_internal_models_to_proto(&models.iter().cloned().cloned().collect::<Vec<_>>());
        result.push(ProtoClassifiedModelGroup {
            property_name: property.to_string(),
            property_value: value,
            models: proto_models,
        });
    }
    // Sort if capability
    if property == "capability" {
        result.sort_by(|a, b| a.property_value.to_lowercase().cmp(&b.property_value.to_lowercase()));
    }
    result
} 
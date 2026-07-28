const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# @generated withMinimumPodDeploymentTarget';

// Matches the `react_native_post_install(...)` call inside the template's
// `post_install` hook, capturing its indentation so the closing paren is
// matched at the same level rather than at the first `)` we happen to find.
const ANCHOR = /^([ \t]*)react_native_post_install\(\r?\n[\s\S]*?^\1\)[ \t]*\r?\n/m;

function rubySnippet(indent, minimumVersion) {
  const lines = [
    '',
    `${MARKER} — do not edit here, edit plugins/withMinimumPodDeploymentTarget.js`,
    `# Raises any pod target below iOS ${minimumVersion} up to it; higher targets are left alone.`,
    '#',
    '# Note: expo-modules-autolinking runs its own reconciliation *after* this',
    '# hook and pins autolinked Expo modules to ExpoModulesCore\'s deployment',
    '# target, so this effectively governs non-Expo pods.',
    `minimum_deployment_target = '${minimumVersion}'`,
    'installer.pods_project.targets.each do |target|',
    '  target.build_configurations.each do |config|',
    "    current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
    // `$(inherited)` and friends aren't comparable versions — leave them alone
    // rather than crashing Gem::Version on an xcconfig reference.
    "    next if !current.nil? && (current.empty? || current.to_s.start_with?('$'))",
    '    if current.nil? || Gem::Version.new(current) < Gem::Version.new(minimum_deployment_target)',
    "      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_deployment_target",
    '    end',
    '  end',
    'end',
  ];
  return lines.map((line) => (line === '' ? '' : `${indent}${line}`)).join('\n') + '\n';
}

/**
 * Pure string transform, exported for testing.
 * @param {string} contents Podfile contents
 * @param {string} minimumVersion e.g. '15.0'
 */
function injectMinimumDeploymentTarget(contents, minimumVersion) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const match = contents.match(ANCHOR);
  if (!match) {
    throw new Error(
      '[withMinimumPodDeploymentTarget] Could not find the `react_native_post_install(...)` ' +
        'call in the Podfile. The Expo template likely changed — update the anchor in ' +
        'plugins/withMinimumPodDeploymentTarget.js.'
    );
  }

  const [anchorText, indent] = match;
  // Replacer function, not a string: the Ruby snippet contains `$'`, which
  // String.replace would otherwise expand as a substitution pattern.
  return contents.replace(anchorText, () => anchorText + rubySnippet(indent, minimumVersion));
}

/**
 * Enforces a minimum iOS deployment target across all Pod targets.
 *
 * The Podfile is Ruby, so this has to be a dangerous mod: the logic must run at
 * `pod install` time (the Pods project does not exist during prebuild), and the
 * stock template has no property hook to drive it, which rules out
 * withPodfileProperties.
 */
const withMinimumPodDeploymentTarget = (config, props = {}) => {
  const minimumVersion = props.minimumDeploymentTarget ?? '15.0';

  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, injectMinimumDeploymentTarget(contents, minimumVersion));
      return config;
    },
  ]);
};

module.exports = withMinimumPodDeploymentTarget;
module.exports.injectMinimumDeploymentTarget = injectMinimumDeploymentTarget;
module.exports.MARKER = MARKER;

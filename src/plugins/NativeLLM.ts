import { registerPlugin } from '@capacitor/core';

export interface NativeLLMPlugin {
  /**
   * Initializes the LLM engine with the model file.
   * @param options.modelPath Name of the file in the app's internal storage.
   */
  initModel(options: { modelPath: string }): Promise<void>;

  /**
   * Runs inference on the native side.
   * @param options.prompt The user command.
   */
  generate(options: { prompt: string }): Promise<{ response: string }>;
}

const NativeLLM = registerPlugin<NativeLLMPlugin>('NativeLLM');

export default NativeLLM;

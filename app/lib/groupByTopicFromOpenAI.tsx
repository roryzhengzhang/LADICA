import { Editor, TLShapeId, createShapeId } from '@tldraw/tldraw'
import { ResponseShape } from '../ResponseShape/ResponseShape'
import { getSelectionAsImageDataUrl } from './getSelectionAsImageDataUrl'
import {
	GPT4CompletionResponse,
	GPT4Message,
	MessageContent,
	fetchFromOpenAi,
} from './fetchFromOpenAi'

// the system prompt explains to gpt-4 what we want it to do and how it should behave.
const systemPrompt = `Imagine you are a very smart and experienced teacher that is able to clue students how to group the presented ideas logically. You are given a list of ideas and some topics based on students want to group those ideas. Your task is to generate groups based on topics and classify ideas into each created group. Let's assume each idea can only belong to a group. Note that it is possible that some ideas are irrevalent to any topic provided. In this case, just don't classify them. Try your best to generate group names as logical and coherent as possible. Group the ideas as reasonable as possible. The explanation of input JSON format is below. Return the text in the provided JSON format. If you think those ideas can't be grouped into any group, just return an empty object.`

const assistantPrompt = `The input JSON format is a list of ideas that could have some logical relationships among them.

The input JSON objects of ideas and topics follow this format:
{
    "ideas": [
        {
            "id": "idea 1 id",
            "text": "text of the idea 1"
        },
        {
            "id": "idea 1 id",
            "text": "text of the idea 1"
        }
    ],
    "topics": ["topic1 name", "topic2 name", ...]
}

The returned JSON objects should follow this format:
{
    "group 1 name": ["idea1 id", "idea2 id", ...],
    "group 2 name": ["idea3 id", "idea4 id", ...],
}

Note you should use node id provided to you in the input JSON object.

`

// Given topic and a list of ideas, this function will return a list of ideas suit for the topic.
export async function groupByTopic (editor, ideas, topic="") {

	// first, we build the prompt that we'll send to openai.
	const prompt = await buildPromptForOpenAi(editor, ideas, topic)

	// TODO: create effect to show loading edges

	try {
		// If you're using the API key input, we preference the key from there.
		// It's okay if this is undefined—it will just mean that we'll use the
		// one in the .env file instead.
		const apiKeyFromDangerousApiKeyInput = (
			document.body.querySelector('#openai_key_risky_but_cool') as HTMLInputElement
		)?.value

		// make a request to openai. `fetchFromOpenAi` is a next.js server action,
		// so our api key is hidden.
		const openAiResponse = await fetchFromOpenAi(apiKeyFromDangerousApiKeyInput, {
			model: 'gpt-4-1106-preview',
			response_format: { type: 'json_object' },
			max_tokens: 4096,
			temperature: 0,
			messages: prompt,
		})

		if (openAiResponse.error) {
			throw new Error(openAiResponse.error.message)
		}

		const response = openAiResponse.choices[0].message.content

		console.log('openAiResponse: ', response)
		const parsed_res = JSON.parse(response)
        return parsed_res
		// populate the response shape with the html we got back from openai.
		// TODO: populate the edges between selected shapes
	} catch (e) {
		// if something went wrong, get rid of the unnecessary response shape

		// TODO: create effect to hide loading edges
		throw e
	}
}

async function buildPromptForOpenAi (editor, ideas, topic) {

	// the user messages describe what the user has done and what they want to do next. they'll get
	// combined with the system prompt to tell gpt-4 what we'd like it to do.
	const userMessages: MessageContent = [
		{
			type: 'text',
			text: 'The first text is the ideas created by students, they are presented in a JSON format as described. The second text is the list of topics. Please suggest group direction that students can cluster them for further analysis.',
		},
		{
			// send the text of all selected shapes, so that GPT can use it as a reference (if anything is hard to see)
			type: 'text',
			text: ideas.length != 0 ? JSON.stringify(ideas) : 'Oh, it looks like there was no idea.',
		},
        {
            type: 'text',
            text: topic ? 'The topic used for creating groups: ' + topic : 'No topic is provided.'
        }
	]

	// combine the user prompt with the system prompt
	return [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userMessages },
		{ role: 'assistant', content: assistantPrompt },
	]
}
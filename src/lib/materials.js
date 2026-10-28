// The four Experiment 2 paragraphs, verbatim from Appendix B of Mesoudi, Whiten
// & Dunbar (2006). Codes follow Appendix B order: 1 = gossip, 2 = social,
// 3 = individual, 4 = physical. Labels and word counts are never shown.
export const PARAGRAPHS = {
	1: 'Nancy is having an affair with her married college professor. Nancy recently became pregnant with the professor’s child. The professor promised Nancy that he would leave his wife, but since Nancy told him she was pregnant, the professor refused to see her. So Nancy told the professor’s wife about the affair. The professor’s wife was so upset that she left the professor.',
	2: 'Nancy enjoys swimming. Nancy was going to the swimming pool but got lost, so she asked an old man waiting at a bus stop for directions. The old man could not give her directions. A bus arrived at the bus stop and the old man asked the driver for directions. The driver gave Nancy directions to the swimming pool, so Nancy was able to go swimming.',
	3: 'One morning, Nancy’s alarm clock broke and she overslept. When she woke up, she realized that she was late for an important lecture. She got dressed as quickly as she could, left the house and ran to the lecture theatre. When she got there, the lecture theatre was empty. Nancy had missed the lecture.',
	4: 'The weather in Colorado gets hot and dry in the summer. This removes moisture from the soil and dries out the plants that grow there. The dry vegetation catches fire easily, leading to frequent forest fires. These fires release smoke containing carbon monoxide into the atmosphere. This smoke contributes to global warming, increasing temperatures further.'
};

// Williams square: each paragraph appears once in each position and follows
// every other paragraph once. Order n is row n.
export const ORDERS = {
	1: [1, 2, 4, 3],
	2: [2, 3, 1, 4],
	3: [3, 4, 2, 1],
	4: [4, 1, 3, 2]
};

// chain k uses row ((k - 1) mod 4), e.g. chain 5 gets order 1 again
export const orderForChain = (chain) => ((chain - 1) % 4) + 1;

// G1 text: the four paragraphs in the chain's order, one blank line apart
export const g1Text = (order) => ORDERS[order].map((code) => PARAGRAPHS[code]).join('\n\n');

export const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

// reading floor at 400 words per minute, e.g. 237 words -> about 36 s
export const readingFloorMs = (text) => Math.round((countWords(text) / 400) * 60000);

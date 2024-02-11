import { z } from "zod";
import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma"
import { redis } from "../../lib/redis";

export async function getPoll(app: FastifyInstance) {


    app.get('/polls/:pollId', async (req, res) => {
        const getPollParams = z.object({
            pollId: z.string().uuid(),
        });

        const { pollId } = getPollParams.parse(req.params);

        const poll = await prisma.poll.findUnique({
            where: {
                id: pollId
            },
            include: {
                options: {
                    select: {
                        id: true,
                        title: true
                    }
                }
            }
        });

        if(!poll){
            return res.status(400).send("Poll not found");
        }

        const result = await redis.zrange(poll.id, 0, -1, "WITHSCORES");

        const votes = result.reduce((obj, row, index) => {
            if(index % 2 === 0){
                const score = [index + 1];
                Object.assign(obj, {[row]: Number(score)});
            }
            return obj;
        }, {} as Record<string, number>);

        return res.status(200).send({ 
            poll : {
                id: poll.id,
                title: poll.title,
                options: poll.options.map(option => {
                    return {
                        id: option.id,
                        title: option.title,
                        score: (option.id in votes) ? votes[option.id] : 0
                    }
                })
            }
         });

    });
}
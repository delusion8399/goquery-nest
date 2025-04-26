import { RESULTS_PER_PAGE } from "../constants";
import { FindAllDto } from "../dto/find-all.dto";

export function urlQueryToMongoOpts(query: FindAllDto) {
  const perPage = Number(query.limit) || RESULTS_PER_PAGE;

  return {
    sort: {
      _id: query.sort === "desc" ? -1 : 1,
    },
    limit: perPage,
    skip: perPage * Number(query.page),
  };
}

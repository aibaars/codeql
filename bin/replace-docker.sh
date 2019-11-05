#! /bin/bash

# rewrite docker run command, but leave all other untouched
if [ "$2" == "run" ]; then
  # rewrite paths in tracer config
  cat ${CODEQL_DB}/working/tracing/tracer.config | sed "s:${CODEQL_DB}:/opt/codeql/database:g" | sed "s:${CODEQL_DIST}:/opt/codeql/dist:g" > ${CODEQL_DB}/working/tracing/trace-docker.config

  # docker run
  COMMAND=("$1" "$2")
  # mount folders and tracer config
  COMMAND+=("-v" "${CODEQL_DIST}:/opt/codeql/dist" "-v" "${CODEQL_DB}:/opt/codeql/database" "-v" "${CODEQL_DB}/working/tracing/trace-docker.config:/opt/codeql/tracer.config")

  # setup tracer env vars
  COMMAND+=("-e" "LD_PRELOAD=/opt/codeql/dist/tools/linux64/\${LIB}trace.so")
  COMMAND+=("-e" "ODASA_TRACER_CONFIGURATION=/opt/codeql/tracer.config")
  COMMAND+=("-e" "CODEQL_DIST=/opt/codeql/dist")
  COMMAND+=("-e" "CODEQL_DB=/opt/codeql/snapshot")
  COMMAND+=("-e" "SOURCE_ARCHIVE=/opt/codeql/database/src")
  COMMAND+=("-e" "TRAP_FOLDER=/opt/codeql/database/trap")

  # add path transformer variable and file
  COMMAND+=("-e" "SEMMLE_PATH_TRANSFORMER=/opt/codeql/path_transformer.txt")
  COMMAND+=("-v" "${CODEQL_DB}/working/path_transformer.txt:/opt/codeql/path_transformer.txt")
  # append original arugments
  COMMAND+=("${@:3}")

  # create path transformer lines for every -v argument
  PREV=""
  echo "" > ${CODEQL_DB}/working/path_transformer.txt
  for arg in "${COMMAND[@]}"
  do
    if [ "$PREV" = "-v" ]; then
      echo "#${arg%:*}" >> ${CODEQL_DB}/working/path_transformer.txt
      echo "${arg##*:}//" >> ${CODEQL_DB}/working/path_transformer.txt
    fi
    PREV="$arg"
  done
  cat ${CODEQL_DB}/working/path_transformer.txt

  exec "${COMMAND[@]}"
else
  exec "$@"
fi
